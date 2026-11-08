#!/usr/bin/env python3
"""Append small APIs needed for 10.12; safe structural checks and *.llm1012.bak backups.
Run from BawarJARVIS- root. Does NOT modify frontend, security, or the database.
"""
from pathlib import Path
import sys

root = Path.cwd()
base = Path('backend/src/main/java/pl/bawar/jarvis/brain')
patches = {
 'optimization/AdamWOptimizer.java': (
  ['private final double[] firstMoment;', 'private final double[] secondMoment;', 'private long stepCount;'],
  'public AdamWState snapshot()', '''
    /** State used to resume AdamW without losing momentum and step counter. */
    public AdamWState snapshot() {
        return new AdamWState(stepCount, firstMoment, secondMoment);
    }

    public void restore(AdamWState state) {
        if (state == null || state.size() != firstMoment.length) {
            throw new IllegalArgumentException("Incompatible AdamW state");
        }
        double[] first = state.first(), second = state.second();
        System.arraycopy(first, 0, firstMoment, 0, first.length);
        System.arraycopy(second, 0, secondMoment, 0, second.length);
        stepCount = state.steps();
    }
'''),
 'training/AdamWModelUpdater.java': (
  ['private final Map<String, AdamWOptimizer> optimizers = new HashMap<>();', 'private final double learningRate;', 'private final double weightDecay;'],
  'Map<String, pl.bawar.jarvis.brain.optimization.AdamWState> snapshotStates()', '''
    double learningRate() { return learningRate; }
    double weightDecay() { return weightDecay; }

    Map<String, pl.bawar.jarvis.brain.optimization.AdamWState> snapshotStates() {
        Map<String, pl.bawar.jarvis.brain.optimization.AdamWState> states = new HashMap<>();
        for (var item : optimizers.entrySet()) {
            states.put(item.getKey(), item.getValue().snapshot());
        }
        return Map.copyOf(states);
    }

    void restoreStates(Map<String, pl.bawar.jarvis.brain.optimization.AdamWState> states) {
        if (states == null) throw new IllegalArgumentException("Missing optimizer states");
        Map<String, AdamWOptimizer> prepared = new HashMap<>();
        for (var entry : states.entrySet()) {
            String key = entry.getKey();
            var state = entry.getValue();
            if (key == null || state == null) throw new IllegalArgumentException("Invalid optimizer entry");
            boolean decayed = key.startsWith("tokens.") || key.startsWith("positions.")
                    || key.contains(".w.");
            AdamWOptimizer optimizer = new AdamWOptimizer(state.size(), learningRate,
                    decayed ? weightDecay : 0.0);
            optimizer.restore(state);
            if (prepared.putIfAbsent(key, optimizer) != null) {
                throw new IllegalArgumentException("Repeated optimizer key");
            }
        }
        optimizers.clear();
        optimizers.putAll(prepared);
    }
'''),
 'training/FullModelTrainer.java': (
  ['private final JarvisLanguageModel model;', 'private final AdamWModelUpdater updater;', 'private final double maxGradientNorm;'],
  'JarvisLanguageModel model() { return model; }', '''
    // Package-private checkpoint access. Only call while training is stopped.
    JarvisLanguageModel model() { return model; }
    AdamWModelUpdater updater() { return updater; }
    double maxGradientNorm() { return maxGradientNorm; }
'''),
}

pending = []
for relative, (markers, method, append) in patches.items():
    file = root / base / relative
    if not file.is_file():
        sys.exit(f'MISSING: {file}. Ensure 10.11 was installed first.')
    source = file.read_text(encoding='utf-8')
    if method in source:
        print('SKIP (already patched):', file)
        continue
    if any(marker not in source for marker in markers) or not source.rstrip().endswith('}'):
        sys.exit(f'STOP: unexpected Java structure in {file}; inspect file manually.')
    end = source.rfind('}')
    pending.append((file, source, source[:end] + append + '\n' + source[end:]))
for file, before, after in pending:
    backup = file.with_name(file.name + '.llm1012.bak')
    if not backup.exists():
        backup.write_text(before, encoding='utf-8')
    file.write_text(after, encoding='utf-8')
    print('PATCHED:', file)
print('Done:', len(pending), 'files. Review git diff before compiling.')
