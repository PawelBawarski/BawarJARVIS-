package pl.bawar.jarvis.agent;

import org.junit.jupiter.api.Test;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import static org.junit.jupiter.api.Assertions.*;

class AgentIsolatedCheckServiceTest {
    private static final AgentIsolatedCheckService.CheckRequest TS =
        new AgentIsolatedCheckService.CheckRequest("frontend/src/demo.ts", "const a = 1;", "const a: number = 2;");

    @Test void disabledByDefaultNeverCallsExecutor() {
        AgentIsolatedCheckService s = new AgentIsolatedCheckService(false, (k, f, b) -> { fail("executed"); return null; });
        assertFalse(s.status().enabled());
        assertThrows(IllegalStateException.class, () -> s.check(TS));
    }

    @Test void mapsModesAndBindsResultToExactProposedHash() {
        AtomicReference<AgentIsolatedCheckService.Kind> actual = new AtomicReference<>();
        AgentIsolatedCheckService s = new AgentIsolatedCheckService(true, (kind, filename, bytes) -> {
            actual.set(kind);
            assertEquals("demo.ts", filename);
            assertEquals(TS.proposed(), new String(bytes, java.nio.charset.StandardCharsets.UTF_8));
            return new AgentIsolatedCheckService.Outcome("passed", "parser ok");
        });
        var result = s.check(TS);
        assertEquals(AgentIsolatedCheckService.Kind.TS_SYNTAX, actual.get());
        assertEquals("passed", result.status());
        assertEquals("parser ok", result.output());
        assertEquals(AgentIsolatedCheckService.sha256(TS.proposed().getBytes(java.nio.charset.StandardCharsets.UTF_8)), result.proposedSha256());
        assertEquals(AgentIsolatedCheckService.Kind.JS_TEST, AgentIsolatedCheckService.kindFor("math.test.js"));
        assertEquals(AgentIsolatedCheckService.Kind.JS_SYNTAX, AgentIsolatedCheckService.kindFor("math.js"));
        assertEquals(AgentIsolatedCheckService.Kind.JAVA_COMPILE, AgentIsolatedCheckService.kindFor("Math.java"));
        assertNull(AgentIsolatedCheckService.kindFor("settings.json"));
    }

    @Test void rejectsPathsAndOversizedContentBeforeExecution() {
        AgentIsolatedCheckService s = new AgentIsolatedCheckService(true, (k, f, b) -> { fail("executed"); return null; });
        assertThrows(IllegalArgumentException.class, () -> s.check(new AgentIsolatedCheckService.CheckRequest("../passwd.js", "old", "new")));
        assertThrows(IllegalArgumentException.class, () -> s.check(new AgentIsolatedCheckService.CheckRequest("safe.js", "same", "same")));
        assertThrows(IllegalArgumentException.class, () -> s.check(new AgentIsolatedCheckService.CheckRequest(".env", "old", "new")));
        assertThrows(IllegalArgumentException.class, () -> s.check(new AgentIsolatedCheckService.CheckRequest("a.json", "old", "new")));
        assertThrows(IllegalArgumentException.class, () -> s.check(new AgentIsolatedCheckService.CheckRequest("a.js", "old", "x".repeat(16_385))));
    }

    @Test void dockerCommandNeverMountsWorkspaceAndIsResourceBounded() {
        var argv = AgentIsolatedCheckService.DockerExecution.dockerCommand(
            AgentIsolatedCheckService.Kind.JS_TEST, "evil.test.js", "jarvis-check-test");
        assertTrue(argv.contains("--pull=never"));
        assertTrue(argv.contains("none"));
        assertTrue(argv.contains("--read-only"));
        assertTrue(argv.contains("--cap-drop=ALL"));
        assertTrue(argv.contains("no-new-privileges"));
        assertTrue(argv.contains("--pids-limit"));
        assertTrue(argv.contains("--memory"));
        assertTrue(argv.contains("--user"));
        assertFalse(argv.contains("--privileged"));
        assertFalse(argv.contains("-v"));
        assertFalse(argv.contains("--mount"));
        assertEquals("node:22-alpine", argv.get(argv.indexOf("--entrypoint") + 2));
        assertFalse(String.join(" ", argv).contains("evil.test.js")); // no shell interpolation of user path
        assertTrue(String.join(" ", argv).contains("/tmp/proposed.test.js"));
        var commonJs = AgentIsolatedCheckService.DockerExecution.dockerCommand(
            AgentIsolatedCheckService.Kind.JS_TEST, "evil.test.cjs", "jarvis-check-test");
        assertTrue(String.join(" ", commonJs).contains("/tmp/proposed.test.cjs"));
    }

    @Test void cannotStartConcurrentCheck() throws Exception {
        CountDownLatch started = new CountDownLatch(1);
        CountDownLatch finish = new CountDownLatch(1);
        AgentIsolatedCheckService s = new AgentIsolatedCheckService(true, (k, f, b) -> {
            started.countDown();
            finish.await(2, TimeUnit.SECONDS);
            return new AgentIsolatedCheckService.Outcome("passed", "ok");
        });
        Thread worker = Thread.startVirtualThread(() -> s.check(TS));
        try {
            assertTrue(started.await(1, TimeUnit.SECONDS));
            assertThrows(IllegalStateException.class, () -> s.check(TS));
        } finally { finish.countDown(); worker.join(); }
    }
}
