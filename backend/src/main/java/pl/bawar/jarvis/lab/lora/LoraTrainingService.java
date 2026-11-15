package pl.bawar.jarvis.lab.lora;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;

/** Fixed-command local training bridge. No request-provided shell, paths, models or URLs. */
@Service
public class LoraTrainingService {
    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;
    private final Path root;
    private final boolean enabled;

    public LoraTrainingService(JdbcTemplate jdbc, ObjectMapper mapper,
            @Value("${JARVIS_LORA_ROOT:}") String configuredRoot,
            @Value("${JARVIS_LORA_TRAINING_ENABLED:false}") boolean enabled) {
        this.jdbc = jdbc;
        this.mapper = mapper;
        // Spring may start from /backend or repository root.
        Path cwd = Path.of(System.getProperty("user.dir")).toAbsolutePath().normalize();
        this.root = configuredRoot == null || configuredRoot.isBlank()
                ? (cwd.getFileName() != null && "backend".equals(cwd.getFileName().toString())
                    ? cwd.getParent() : cwd)
                : Path.of(configuredRoot).toAbsolutePath().normalize();
        this.enabled = enabled;
    }

    public record Run(String runId, String status, int step, int totalSteps,
                      Double loss, Integer vramMiB, String error, boolean processAlive) {}

    public static void validate(int steps, int seqLen) {
        if (steps < 1 || steps > 200 || seqLen < 64 || seqLen > 512)
            throw new IllegalArgumentException("steps 1..200; seqLen 64..512");
    }

    private Path python() {
        Path path = root.resolve(".venv-training/Scripts/python.exe");
        if (!Files.isRegularFile(path)) path = root.resolve(".venv-training/bin/python");
        if (!Files.isRegularFile(path)) throw new IllegalStateException("LORA_PYTHON_NOT_FOUND");
        return path;
    }

    private String command(String... parameters) {
        if (!enabled) throw new IllegalStateException("LORA_TRAINING_DISABLED");
        Path controller = root.resolve("training/control_lora.py").normalize();
        if (!Files.isRegularFile(controller)) throw new IllegalStateException("LORA_CONTROLLER_NOT_FOUND");
        var args = new java.util.ArrayList<String>();
        args.add(python().toString()); args.add(controller.toString());
        args.addAll(List.of(parameters));
        try {
            // Redirect before waitFor: no pipe-buffer deadlock, bounded output, no secret log leakage.
            Path output = Files.createTempFile("jarvis-lora-controller-", ".log");
            try {
                Process p = new ProcessBuilder(args).directory(root.toFile())
                        .redirectErrorStream(true).redirectOutput(output.toFile()).start();
                // Python controller is short-lived. The actual trainer is spawned separately.
                boolean finished = p.waitFor(25, TimeUnit.SECONDS);
                if (!finished) {
                    p.destroyForcibly();
                    p.waitFor(5, TimeUnit.SECONDS);
                    throw new IllegalStateException("LORA_CONTROLLER_TIMEOUT");
                }
                if (p.exitValue() != 0) throw new IllegalStateException("LORA_CONTROLLER_ERROR");
                if (Files.size(output) > 1_048_576) throw new IllegalStateException("LORA_CONTROLLER_OUTPUT_TOO_LARGE");
                return Files.readString(output, StandardCharsets.UTF_8);
            } finally {
                Files.deleteIfExists(output);
            }
        } catch (IOException e) {
            throw new IllegalStateException("LORA_PROCESS_START_FAILED", e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("LORA_CONTROLLER_INTERRUPTED", e);
        }
    }

    static JsonNode firstObject(ObjectMapper mapper, String output) {
        int start = output.indexOf('{');
        int end = output.indexOf('}', start);
        if (start < 0 || end < start) throw new IllegalStateException("LORA_INVALID_CONTROLLER_OUTPUT");
        return mapper.readTree(output.substring(start, end + 1));
    }

    private Run decode(String output) {
        JsonNode value = firstObject(mapper, output);
        return new Run(text(value, "runId", null), text(value, "status", "unknown"),
                number(value,"step",0),number(value,"totalSteps",number(value,"steps",0)),
                decimal(value,"loss"),integer(value,"vramMiB"),
                text(value,"error",null),value.path("processAlive").asBoolean(false));
    }
    private static String text(JsonNode v, String name, String fallback) {
        JsonNode n = v.path(name); return n.isMissingNode() || n.isNull() ? fallback : n.asText();
    }
    private static int number(JsonNode v, String name, int fallback) {
        JsonNode n=v.path(name); return n.isNumber() ? n.asInt() : fallback;
    }
    private static Integer integer(JsonNode v,String name) {
        JsonNode n=v.path(name); return n.isNumber() ? n.asInt() : null;
    }
    private static Double decimal(JsonNode v,String name) {
        JsonNode n=v.path(name); return n.isNumber() ? n.asDouble() : null;
    }

    private void persist(Run r) {
        if (r.runId() == null || !r.runId().matches("lora-[0-9]{8}-[0-9]{6}-[a-f0-9]{8}")) return;
        jdbc.update("""
            INSERT INTO lora_training_runs(run_id,status,total_steps,completed_steps,loss,vram_mib,error_message)
            VALUES(?,?,?,?,?,?,?)
            ON CONFLICT (run_id) DO UPDATE SET status=excluded.status,
            completed_steps=excluded.completed_steps, loss=excluded.loss,
            vram_mib=excluded.vram_mib, error_message=excluded.error_message, updated_at=now()
            """, r.runId(), r.status(), r.totalSteps(), r.step(), r.loss(), r.vramMiB(), r.error());
    }

    public synchronized Run status() {
        if (!enabled) return new Run(null,"disabled",0,0,null,null,"LORA_TRAINING_DISABLED",false);
        Run result=decode(command("status"));
        persist(result);
        return result;
    }

    public synchronized Run start(int steps,int seqLen) {
        validate(steps,seqLen);
        ensureEnabled();
        Run existing=status();
        if (existing.processAlive()) throw new IllegalStateException("LORA_ALREADY_RUNNING");
        Run result=decode(command("start","--steps",String.valueOf(steps),"--seq-len",String.valueOf(seqLen)));
        persist(result);
        return result;
    }

    private void ensureEnabled() {
        if (!enabled) throw new IllegalStateException("LORA_TRAINING_DISABLED");
    }

    public record DatasetInfo(String id,int examples){}
    public List<DatasetInfo> datasets() {
        Path folder=root.resolve("training/data");
        if (!Files.isDirectory(folder)) return List.of();
        try (var stream=Files.list(folder)) {
            return stream.filter(x->x.getFileName().toString().matches("reviewed-[a-f0-9-]{36}\\.jsonl"))
                .limit(100).map(x -> {
                    try { return new DatasetInfo(x.getFileName().toString().replace(".jsonl",""),
                        countLines(x)); }
                    catch (IOException e) { return new DatasetInfo(x.getFileName().toString().replace(".jsonl",""),0); }
                }).toList();
        } catch (IOException e) { throw new IllegalStateException("DATASETS_LIST_FAILED",e); }
    }
    private static int countLines(Path file) throws IOException {
        if (Files.size(file) > 10_485_760) return 0; // malformed/oversize dataset is never advertised
        try (var lines = Files.lines(file, StandardCharsets.UTF_8)) {
            return (int) Math.min(lines.limit(501).count(), 501);
        }
    }

    public synchronized Run startReviewed(int steps,int seqLen,String datasetId) {
        validate(steps,seqLen);
        ensureEnabled();
        if (datasetId==null || !datasetId.matches("reviewed-[a-f0-9-]{36}"))
            throw new IllegalArgumentException("INVALID_REVIEWED_DATASET_ID");
        Path file=root.resolve("training/data").resolve(datasetId+".jsonl").normalize();
        if (!Files.isRegularFile(file)) throw new IllegalArgumentException("DATASET_NOT_FOUND");
        Run existing=status();
        if(existing.processAlive()) throw new IllegalStateException("LORA_ALREADY_RUNNING");
        Run result=decode(command("start","--steps",String.valueOf(steps),"--seq-len",String.valueOf(seqLen),
                    "--data",datasetId));
        persist(result);
        jdbc.update("UPDATE lora_training_runs SET dataset_id=? WHERE run_id=?",datasetId,result.runId());
        return result;
    }
    public synchronized Run stop() {
        ensureEnabled();
        command("stop");
        return status();
    }

    public List<Run> history() {
        return jdbc.query("""
          SELECT run_id,status,completed_steps,total_steps,loss,vram_mib,error_message
          FROM lora_training_runs ORDER BY started_at DESC LIMIT 30
          """, (rs,i)->new Run(rs.getString(1),rs.getString(2),rs.getInt(3),rs.getInt(4),
              (Double)rs.getObject(5), (Integer)rs.getObject(6),rs.getString(7),false));
    }
}
