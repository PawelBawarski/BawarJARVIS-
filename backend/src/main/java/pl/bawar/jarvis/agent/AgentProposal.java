package pl.bawar.jarvis.agent;

import java.time.Instant;
import java.util.UUID;

/** A reviewed plan. Approval means approval of the plan, NOT execution of code. */
public record AgentProposal(UUID id, String task, String plan, String status,
                            Instant createdAt, Instant updatedAt) { }
