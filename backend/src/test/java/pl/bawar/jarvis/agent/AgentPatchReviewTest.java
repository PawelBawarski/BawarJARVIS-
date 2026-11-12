package pl.bawar.jarvis.agent;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class AgentPatchReviewTest {
    @Test void countsOnlyChangedMiddleAndPreservesContext() {
        var summary = AgentPatchReview.examine("header\na\nb\nfooter", "header\na\nc\nfooter");
        assertEquals(4, summary.beforeLines());
        assertEquals(4, summary.afterLines());
        assertEquals(1, summary.removedLines());
        assertEquals(1, summary.addedLines());
        assertTrue(summary.warnings().isEmpty());
    }

    @Test void highlightsNewExecutionAndDynamicEvaluationButNotPreexistingLines() {
        var summary = AgentPatchReview.examine("const x = 1;", "eval('x')\nconst x = 1;");
        assertTrue(summary.warnings().contains("DYNAMIC_CODE"));
        var existing = AgentPatchReview.examine("eval('x');\nlet a = 1", "eval('x');\nlet a = 2");
        assertFalse(existing.warnings().contains("DYNAMIC_CODE"));
        assertTrue(AgentPatchReview.examine("int x = 1;", "new ProcessBuilder(\"cmd\");").warnings().contains("PROCESS_EXECUTION"));
    }

    @Test void warnsOnPossibleHardcodedCredentialAndLargeReplacements() {
        var credential = AgentPatchReview.examine("const active = true;", "const token = 'sample-test-credential';");
        assertTrue(credential.warnings().contains("POSSIBLE_SECRET"));
        var longDiff = AgentPatchReview.examine("old", "a\n".repeat(50));
        assertTrue(longDiff.warnings().contains("LARGE_CHANGE"));
    }
}
