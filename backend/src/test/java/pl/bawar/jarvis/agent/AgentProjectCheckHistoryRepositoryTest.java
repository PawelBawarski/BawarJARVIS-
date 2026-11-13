package pl.bawar.jarvis.agent;

import static org.junit.jupiter.api.Assertions.*;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

class AgentProjectCheckHistoryRepositoryTest {
    private JdbcTemplate memoryDb() {
        var ds = new DriverManagerDataSource("jdbc:h2:mem:checks_" + UUID.randomUUID() + ";DB_CLOSE_DELAY=-1");
        ds.setDriverClassName("org.h2.Driver");
        var jdbc = new JdbcTemplate(ds);
        jdbc.execute("""
            CREATE TABLE jarvis_agent_project_check_history (
              check_id UUID PRIMARY KEY, kind VARCHAR(16), status VARCHAR(16),
              relative_path VARCHAR(240), proposed_sha256 CHAR(64), snapshot_sha256 CHAR(64),
              image_name VARCHAR(200), file_count INTEGER, elapsed_ms BIGINT,
              created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP)
            """);
        return jdbc;
    }

    @Test void storesOnlyMetadataAndBoundsHistoryLimit() {
        var jdbc = memoryDb();
        var repo = new AgentProjectCheckHistoryRepository(jdbc);
        var pass = new AgentProjectCheckService.Result(UUID.randomUUID().toString(), "angular", "passed",
            "PASS", "src/app/demo.ts", "a".repeat(64), "b".repeat(64), "test-image", 5,
            "secret=DO_NOT_PERSIST", 190);
        repo.save(pass);
        var history = repo.recent(10000);
        assertEquals(1, history.size());
        assertEquals("passed", history.getFirst().status());
        assertEquals(pass.checkId(), history.getFirst().checkId().toString());
        assertFalse(history.getFirst().toString().contains("DO_NOT_PERSIST"));
        assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM jarvis_agent_project_check_history WHERE relative_path LIKE '%secret%'", Integer.class));
        assertEquals(1, repo.recent(-100).size());
    }

    @Test void recordsOnlyServerRunnerResultAndNeverUnvalidatedInput() {
        var repo = new AgentProjectCheckHistoryRepository(memoryDb());
        var runner = new AgentProjectCheckService(true, snapshot -> new AgentProjectCheckService.Outcome("failed", "test failed"));
        var controller = new AgentProjectCheckController(runner, repo);
        var request = new AgentProjectCheckService.Request("angular", "frontend/src/app/demo.ts", "old", "new", List.of(
            new AgentProjectCheckService.Source("package.json", "{}"),
            new AgentProjectCheckService.Source("package-lock.json", "{}"),
            new AgentProjectCheckService.Source("angular.json", "{}"),
            new AgentProjectCheckService.Source("tsconfig.json", "{}"),
            new AgentProjectCheckService.Source("src/app/demo.ts", "old")
        ));
        assertEquals("failed", controller.run(request).status());
        assertEquals("failed", controller.history(5).getFirst().status());
        assertThrows(IllegalArgumentException.class, () -> controller.run(
            new AgentProjectCheckService.Request("angular", "frontend/src/app/demo.ts", "wrong", "new", request.files())));
        assertEquals(1, controller.history(5).size());
    }
}
