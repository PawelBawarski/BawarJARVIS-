package pl.bawar.jarvis.agent;

import java.util.Arrays;
import java.util.List;

/** Unified-style whole-fragment diff (view-only, NOT an auto-applicable patch). */
final class AgentPatchDiff {
    private AgentPatchDiff() { }

    static String unified(String relativePath, String before, String after) {
        List<String> original = Arrays.asList(before.split("\\n", -1));
        List<String> proposed = Arrays.asList(after.split("\\n", -1));
        int prefix = 0;
        while (prefix < original.size() && prefix < proposed.size() &&
            original.get(prefix).equals(proposed.get(prefix))) prefix++;
        int suffix = 0;
        while (suffix < original.size() - prefix && suffix < proposed.size() - prefix &&
            original.get(original.size() - suffix - 1).equals(proposed.get(proposed.size() - suffix - 1))) suffix++;

        int start = Math.max(0, prefix - 3);
        int oldEnd = Math.min(original.size(), original.size() - suffix + 3);
        int newEnd = Math.min(proposed.size(), proposed.size() - suffix + 3);
        StringBuilder text = new StringBuilder("--- a/").append(relativePath)
            .append("\n+++ b/").append(relativePath)
            .append("\n@@ -").append(start + 1).append(',').append(oldEnd - start)
            .append(" +").append(start + 1).append(',').append(newEnd - start).append(" @@\n");
        for (int i = start; i < prefix; i++) text.append(' ').append(original.get(i)).append('\n');
        for (int i = prefix; i < original.size() - suffix; i++) text.append('-').append(original.get(i)).append('\n');
        for (int i = prefix; i < proposed.size() - suffix; i++) text.append('+').append(proposed.get(i)).append('\n');
        for (int i = 0; i < oldEnd - (original.size() - suffix); i++) {
            text.append(' ').append(original.get(original.size() - suffix + i)).append('\n');
        }
        return text.toString();
    }
}
