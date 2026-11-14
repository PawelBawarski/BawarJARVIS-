package pl.bawar.jarvis.agent;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
class AgentProposalRepositoryIntegrationTest {

    @Autowired
    AgentProposalRepository repository;

    @Autowired
    JdbcTemplate jdbc;

    @Test
    void createReturnsPersistedProposal() {
        String task = "Test M02 " + UUID.randomUUID();
        AgentProposal created = repository.create(
            task, "Plan bez wykonywania poleceń"
        );

        try {
            assertNotNull(created.id());
            assertEquals(task, created.task());
            assertEquals("Plan bez wykonywania poleceń", created.plan());
            assertEquals("PENDING", created.status());
            assertNotNull(created.createdAt());
            assertNotNull(created.updatedAt());
            assertEquals(created, repository.find(created.id()));
        } finally {
            jdbc.update(
                "DELETE FROM jarvis_agent_proposals WHERE id = ?",
                created.id()
            );
        }
    }

    @Test
    void approvedProposalCannotBeRevisedOrReviewedAgain() {
        AgentProposal created = repository.create(
            "Review M02 " + UUID.randomUUID(),
            "Initial plan"
        );

        try {
            AgentProposal approved =
                repository.decide(created.id(), "APPROVED");

            assertEquals("APPROVED", approved.status());

            assertThrows(
                IllegalStateException.class,
                () -> repository.revise(created.id(), "Changed plan")
            );

            assertThrows(
                IllegalStateException.class,
                () -> repository.decide(created.id(), "REJECTED")
            );

            AgentProposal stored = repository.find(created.id());

            assertEquals("APPROVED", stored.status());
            assertEquals("Initial plan", stored.plan());
        } finally {
            jdbc.update(
                "DELETE FROM jarvis_agent_proposals WHERE id = ?",
                created.id()
            );
        }
    }

    @Test
    void concurrentDecisionsAllowOnlyOneFinalState() throws Exception {
        AgentProposal created = repository.create(
            "Concurrent M02 " + UUID.randomUUID(),
            "Plan do zatwierdzenia"
        );

        var executor =
            java.util.concurrent.Executors.newFixedThreadPool(2);

        var ready = new java.util.concurrent.CountDownLatch(2);
        var start = new java.util.concurrent.CountDownLatch(1);

        try {
            java.util.concurrent.Callable<Boolean> approve = () -> {
                ready.countDown();
                if (!start.await(10, java.util.concurrent.TimeUnit.SECONDS)) {
                    throw new IllegalStateException("Start timeout");
                }
                try {
                    repository.decide(created.id(), "APPROVED");
                    return true;
                } catch (IllegalStateException expectedConflict) {
                    return false;
                }
            };

            java.util.concurrent.Callable<Boolean> reject = () -> {
                ready.countDown();
                if (!start.await(10, java.util.concurrent.TimeUnit.SECONDS)) {
                    throw new IllegalStateException("Start timeout");
                }
                try {
                    repository.decide(created.id(), "REJECTED");
                    return true;
                } catch (IllegalStateException expectedConflict) {
                    return false;
                }
            };

            var first = executor.submit(approve);
            var second = executor.submit(reject);

            assertTrue(
                ready.await(10, java.util.concurrent.TimeUnit.SECONDS),
                "Both threads should reach the start barrier"
            );

            start.countDown();

            boolean firstAccepted =
                first.get(30, java.util.concurrent.TimeUnit.SECONDS);

            boolean secondAccepted =
                second.get(30, java.util.concurrent.TimeUnit.SECONDS);

            // Exactly one decision must succeed.
            assertNotEquals(firstAccepted, secondAccepted);

            AgentProposal stored = repository.find(created.id());

            assertEquals(
                firstAccepted ? "APPROVED" : "REJECTED",
                stored.status()
            );
            assertEquals("Plan do zatwierdzenia", stored.plan());

            assertThrows(
                IllegalStateException.class,
                () -> repository.decide(created.id(), "APPROVED")
            );

            assertThrows(
                IllegalStateException.class,
                () -> repository.revise(created.id(), "Other plan")
            );

        } finally {
            start.countDown();
            executor.shutdownNow();

            try {
                assertTrue(
                    executor.awaitTermination(
                        10, java.util.concurrent.TimeUnit.SECONDS
                    ),
                    "Worker threads should terminate"
                );
            } finally {
                jdbc.update(
                    "DELETE FROM jarvis_agent_proposals WHERE id = ?",
                    created.id()
                );
            }
        }
    }

}
