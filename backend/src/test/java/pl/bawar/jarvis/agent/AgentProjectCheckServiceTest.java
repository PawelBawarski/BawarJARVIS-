package pl.bawar.jarvis.agent;

import static org.junit.jupiter.api.Assertions.*;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;

class AgentProjectCheckServiceTest {
    private AgentProjectCheckService.Request angular(String before, String after) {
        return new AgentProjectCheckService.Request("angular", "frontend/src/app/demo.ts", before, after,
            List.of(new AgentProjectCheckService.Source("package.json", "{}"),
                    new AgentProjectCheckService.Source("package-lock.json", "{}"),
                    new AgentProjectCheckService.Source("angular.json", "{}"),
                    new AgentProjectCheckService.Source("tsconfig.json", "{}"),
                    new AgentProjectCheckService.Source("src/app/demo.ts", before)));
    }
    @Test void disabledCheckDoesNotExecute() {
        AtomicInteger calls = new AtomicInteger();
        var service = new AgentProjectCheckService(false, snapshot -> {
            calls.incrementAndGet(); return new AgentProjectCheckService.Outcome("passed", "ok");
        });
        assertThrows(IllegalStateException.class, () -> service.check(angular("old", "new")));
        assertEquals(0, calls.get());
    }
    @Test void validatesOriginalAndOverlaysOnlyTemporarySnapshot() {
        var input = angular("export const n = 1;", "export const n = 2;");
        var service = new AgentProjectCheckService(true, snapshot -> {
            assertTrue(snapshot.image().matches("jarvis-angular-test:19-4-[0-9a-f]{12}"));
            try (var archive = new java.util.zip.ZipInputStream(new java.io.ByteArrayInputStream(snapshot.zip()))) {
                boolean found = false;
                for (var entry = archive.getNextEntry(); entry != null; entry = archive.getNextEntry()) {
                    if (entry.getName().equals("src/app/demo.ts")) {
                        assertEquals("export const n = 2;", new String(archive.readAllBytes(), java.nio.charset.StandardCharsets.UTF_8));
                        found = true;
                    }
                }
                assertTrue(found);
            }
            return new AgentProjectCheckService.Outcome("passed", "all green");
        });
        var result = service.check(input);
        assertEquals("passed", result.status());
        assertEquals(64, result.proposedSha256().length());
        assertEquals(64, result.snapshotSha256().length());
        assertEquals(5, result.fileCount());
        assertEquals("export const n = 1;", input.files().get(4).content());
    }
    @Test void rejectsStaleSourceTraversalSecretsAndDuplicatePaths() {
        var stale = angular("old", "new");
        var mismatch = assertThrows(IllegalArgumentException.class, () -> AgentProjectCheckService.snapshot(
            new AgentProjectCheckService.Request("angular", stale.relativePath(), "wrong",
                stale.proposed(), stale.files())));
        assertEquals("PROJECT_SOURCE_MISMATCH", mismatch.getMessage());
        assertFalse(AgentProjectCheckService.allowed("src/../../.env", true));
        assertFalse(AgentProjectCheckService.allowed("node_modules/package.json", true));
        assertFalse(AgentProjectCheckService.allowed("src/app/private.key", true));
        assertFalse(AgentProjectCheckService.allowed(".env", false));
        var files = new ArrayList<>(angular("old", "new").files());
        files.add(new AgentProjectCheckService.Source("SRC/app/demo.ts", "old"));
        assertThrows(IllegalArgumentException.class, () -> AgentProjectCheckService.snapshot(
            new AgentProjectCheckService.Request("angular", "src/app/demo.ts", "old", "new", files)));
    }
    @Test void bindsImageToDependencyManifestAndAllFilesToSnapshot() {
        var a = AgentProjectCheckService.snapshot(angular("old", "new"));
        var files = new ArrayList<>(angular("old", "new").files());
        files.set(0, new AgentProjectCheckService.Source("package.json", "{\"name\":\"different\"}"));
        var b = AgentProjectCheckService.snapshot(new AgentProjectCheckService.Request("angular", "src/app/demo.ts", "old", "new", files));
        assertNotEquals(a.image(), b.image());
        assertNotEquals(a.snapshotSha256(), b.snapshotSha256());
        assertEquals(a.proposedSha256(), b.proposedSha256());
    }
    @Test void dockerCommandHasNoMountNetworkOrSourceArgs() {
        var a = AgentProjectCheckService.snapshot(angular("old", "new"));
        var args = AgentProjectCheckService.DockerExecution.command(a, "jarvis-project-test");
        String command = String.join(" ", args);
        assertTrue(command.contains("--network none"));
        assertTrue(command.contains("--read-only"));
        assertTrue(command.contains("--pull=never"));
        assertTrue(command.contains("--cap-drop=ALL"));
        assertFalse(args.contains("-v"));
        assertFalse(args.contains("--mount"));
        assertFalse(command.contains("export const n"));
    }
    @Test void springProjectAcceptsPomAndSourcesWithoutNpm() {
        var input = new AgentProjectCheckService.Request("spring", "backend/src/main/java/demo/Demo.java", "class Demo {}", "class Demo { int n; }",
            List.of(new AgentProjectCheckService.Source("pom.xml", "<project/ >"),
                    new AgentProjectCheckService.Source("src/main/java/demo/Demo.java", "class Demo {}")));
        var s = AgentProjectCheckService.snapshot(input);
        assertEquals("spring", s.kind());
        assertTrue(s.image().startsWith("jarvis-spring-test:19-4-"));
    }
}
