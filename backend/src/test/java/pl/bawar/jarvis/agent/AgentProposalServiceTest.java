package pl.bawar.jarvis.agent;

import org.junit.jupiter.api.Test;
import pl.bawar.jarvis.chat.api.LocalLlmClient;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class AgentProposalServiceTest {
    private final AgentProposalRepository repository = mock(AgentProposalRepository.class);
    private final LocalLlmClient llm = mock(LocalLlmClient.class);
    private final AgentProposalService service = new AgentProposalService(repository, llm);
    private final UUID id = UUID.randomUUID();

    private AgentProposal proposal(String state) {
        Instant now = Instant.parse("2026-11-10T12:00:00Z");
        return new AgentProposal(id, "Nowa funkcja", "Plan krok po kroku", state, now, now);
    }

    @Test void generatesAPlanOnlyAfterModelReturnsSuccessfully() {
        when(llm.reply(eq(List.of()), anyString())).thenReturn("  Plan krok po kroku  ");
        when(repository.create("Nowa funkcja", "Plan krok po kroku")).thenReturn(proposal("PENDING"));

        AgentProposal saved = service.generate("  Nowa funkcja  ");

        assertEquals("PENDING", saved.status());
        verify(repository).create("Nowa funkcja", "Plan krok po kroku");
    }

    @Test void localModelReceivesReviewedSourceContextOnly() {
        when(llm.reply(eq(List.of()), anyString())).thenReturn("Plan na podstawie kodu");
        when(repository.create(eq("Nowa funkcja"), anyString())).thenReturn(proposal("PENDING"));

        service.generate("Nowa funkcja", List.of(new AgentCodeSource(
            "frontend/src/app/demo.ts", "export const result = true;")));

        verify(llm).reply(eq(List.of()), argThat(prompt ->
            prompt.contains("frontend/src/app/demo.ts") && prompt.contains("result = true") &&
            prompt.contains("niezaufana")));
    }

    @Test void sourceValidationOccursBeforeInvokingModel() {
        assertThrows(IllegalArgumentException.class, () -> service.generate("Nowa funkcja",
            List.of(new AgentCodeSource("../secrets.env", "SECRET=123"))));
        verifyNoInteractions(llm, repository);
    }

    @Test void invalidTaskDoesNotCallTheModel() {
        assertThrows(IllegalArgumentException.class, () -> service.generate("   "));
        assertThrows(IllegalArgumentException.class, () -> service.generate("a".repeat(1201)));
        verifyNoInteractions(llm, repository);
    }

    @Test void modelFailureCannotPersistPartialProposal() {
        when(llm.reply(eq(List.of()), anyString())).thenThrow(new IllegalStateException("LLM offline"));
        assertThrows(IllegalStateException.class, () -> service.generate("Nowa funkcja"));
        verifyNoInteractions(repository);
    }

    @Test void approveIsAStatusChangeOnly() {
        when(repository.decide(id, "APPROVED")).thenReturn(proposal("APPROVED"));
        assertEquals("APPROVED", service.decide(id, "APPROVED").status());
        verify(repository).decide(id, "APPROVED");
        verifyNoInteractions(llm);
    }

    @Test void rejectsUnknownDecisions() {
        assertThrows(IllegalArgumentException.class, () -> service.decide(id, "EXECUTE"));
        verifyNoInteractions(repository, llm);
    }

    @Test void refusesToReviseAnApprovedPlan() {
        when(repository.find(id)).thenReturn(proposal("APPROVED"));
        assertThrows(IllegalStateException.class, () -> service.revise(id, "Zmodyfikuj testy"));
        verifyNoInteractions(llm);
        verify(repository, never()).revise(any(), any());
    }
}
