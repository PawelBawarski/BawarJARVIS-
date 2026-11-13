package pl.bawar.jarvis.agent;

import static org.junit.jupiter.api.Assertions.*;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.zip.ZipInputStream;
import org.junit.jupiter.api.Test;

class AgentModuleCheckServiceTest {
    private static AgentModuleCheckService.CheckRequest request() {
        return new AgentModuleCheckService.CheckRequest(
            "frontend/src/app/counter.js", "export const n = 1;", "export const n = 2;",
            List.of(new AgentModuleCheckService.Source("counter.test.js", "import {test} from 'node:test'; test('ok',()=>{});")),
            "counter.test.js");
    }

    @Test void requiresExplicitEnableAndNeverRunsIfDisabled() {
        AtomicInteger calls = new AtomicInteger();
        var service = new AgentModuleCheckService(false, snapshot -> {
            calls.incrementAndGet(); return new AgentModuleCheckService.Outcome("passed", "ok");
        });
        assertThrows(IllegalStateException.class, () -> service.check(request()));
        assertEquals(0, calls.get());
    }

    @Test void keepsProposalAndSnapshotHashesAndOnlyRunsApprovedInput() {
        var service = new AgentModuleCheckService(true, snapshot -> {
            assertEquals("JS_TEST_MODULE", snapshot.kind());
            assertEquals("frontend/src/app/counter.test.js", snapshot.testFile());
            assertEquals(2, snapshot.fileCount());
            try (var stream = new ZipInputStream(new java.io.ByteArrayInputStream(snapshot.zip()))) {
                var entry = stream.getNextEntry();
                assertEquals("frontend/src/app/counter.js", entry.getName());
                assertEquals("export const n = 2;", new String(stream.readAllBytes(), StandardCharsets.UTF_8));
            }
            return new AgentModuleCheckService.Outcome("passed", "1 test passed");
        });
        var outcome = service.check(request());
        assertEquals("passed", outcome.status());
        assertEquals(64, outcome.proposedSha256().length());
        assertEquals(64, outcome.snapshotSha256().length());
        assertEquals(2, outcome.fileCount());
    }

    @Test void changesToAnyRelatedFileChangeTheSnapshotFingerprint() {
        var base = AgentModuleCheckService.snapshot(request());
        var changed = AgentModuleCheckService.snapshot(new AgentModuleCheckService.CheckRequest(
            request().relativePath(), request().original(), request().proposed(),
            List.of(new AgentModuleCheckService.Source("counter.test.js", "changed")), "counter.test.js"));
        assertEquals(base.proposedSha256(), changed.proposedSha256());
        assertNotEquals(base.snapshotSha256(), changed.snapshotSha256());
    }

    @Test void refusesTraversalSecretsDuplicatesAndUnsupportedFiles() {
        for (var extra : List.of(
            new AgentModuleCheckService.Source("../passwd.js", "x"),
            new AgentModuleCheckService.Source("secret.env", "x"),
            new AgentModuleCheckService.Source("counter.js", "x"),
            new AgentModuleCheckService.Source("node_modules/x.js", "x"),
            new AgentModuleCheckService.Source("bad.ts", "x")
        )) {
            assertThrows(IllegalArgumentException.class, () -> AgentModuleCheckService.snapshot(
                new AgentModuleCheckService.CheckRequest("frontend/src/app/counter.js", "x", "y", List.of(extra), "")));
        }
        assertThrows(IllegalArgumentException.class, () -> AgentModuleCheckService.snapshot(
            new AgentModuleCheckService.CheckRequest("a.js", "old", "new", List.of(), "missing.test.js")));
        assertThrows(IllegalArgumentException.class, () -> AgentModuleCheckService.snapshot(
            new AgentModuleCheckService.CheckRequest("a.js", "old", "new", List.of(), "x;touch /tmp/z.test.js")));
    }

    @Test void rejectsOversizeFilesAndFileCount() {
        assertThrows(IllegalArgumentException.class, () -> AgentModuleCheckService.snapshot(
            new AgentModuleCheckService.CheckRequest("a.js", "old", "x".repeat(32_769), List.of(), "")));
        var extras = java.util.stream.IntStream.range(0, 9)
            .mapToObj(n -> new AgentModuleCheckService.Source("a" + n + ".js", "x"))
            .toList();
        assertThrows(IllegalArgumentException.class, () -> AgentModuleCheckService.snapshot(
            new AgentModuleCheckService.CheckRequest("a.js", "old", "new", extras, "")));
    }

    @Test void dockerCommandNeverMountsWorkspaceAndOnlyUsesFixedScript() {
        var snapshot = AgentModuleCheckService.snapshot(request());
        var args = AgentModuleCheckService.DockerExecution.command(snapshot, "jarvis-module-test");
        String cmd = String.join(" ", args);
        assertTrue(cmd.contains("--network none"));
        assertTrue(cmd.contains("--read-only"));
        assertTrue(cmd.contains("--cap-drop=ALL"));
        assertTrue(cmd.contains("--pull=never"));
        assertTrue(cmd.contains("--memory 384m"));
        assertFalse(args.contains("-v"));
        assertFalse(args.contains("--mount"));
        assertFalse(cmd.contains("export const n = 2"));
        assertTrue(args.contains("frontend/src/app/counter.test.js"));
    }
}
