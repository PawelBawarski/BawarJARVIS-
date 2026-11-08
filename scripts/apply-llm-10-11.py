#!/usr/bin/env python3
"""Append explicit parameter accessors without replacing existing Java classes.
Run once from BawarJARVIS- root. Copies original files to *.llm1011.bak.
"""
from pathlib import Path
import sys

root = Path.cwd()
base = Path('backend/src/main/java/pl/bawar/jarvis/brain')
patches = {
    'layers/DenseLayer.java': (
        'private final double[][] weights;',
        'public double[][] weightsCopy()',
        '''
    // Explicit trainable-parameter API (LLM 10.11); no reflection.
    public double[][] weightsCopy() {
        double[][] copy = new double[weights.length][];
        for (int i = 0; i < weights.length; i++) copy[i] = weights[i].clone();
        return copy;
    }

    public double[] biasesCopy() { return biases.clone(); }

    public void replaceParameters(double[][] newWeights, double[] newBiases) {
        if (newWeights == null || newWeights.length != weights.length
                || newBiases == null || newBiases.length != biases.length) {
            throw new IllegalArgumentException("Dense parameter shape mismatch");
        }
        for (double[] row : newWeights) {
            if (row == null || row.length != biases.length) {
                throw new IllegalArgumentException("Dense matrix width mismatch");
            }
            for (double x : row) if (!Double.isFinite(x))
                throw new IllegalArgumentException("Dense weights must be finite");
        }
        for (double x : newBiases) if (!Double.isFinite(x))
            throw new IllegalArgumentException("Dense biases must be finite");
        for (int i = 0; i < weights.length; i++)
            System.arraycopy(newWeights[i], 0, weights[i], 0, biases.length);
        System.arraycopy(newBiases, 0, biases, 0, biases.length);
    }
'''),
    'layers/FeedForwardNetwork.java': (
        'private final DenseLayer inputLayer;',
        'public DenseLayer inputLayer()',
        '''
    public DenseLayer inputLayer() { return inputLayer; }
    public DenseLayer outputLayer() { return outputLayer; }
'''),
    'attention/CausalSelfAttention.java': (
        'private final DenseLayer queryProjection;',
        'public DenseLayer queryProjection()',
        '''
    public DenseLayer queryProjection() { return queryProjection; }
    public DenseLayer keyProjection() { return keyProjection; }
    public DenseLayer valueProjection() { return valueProjection; }
'''),
    'attention/MultiHeadAttention.java': (
        'private final List<CausalSelfAttention> heads;',
        'public List<CausalSelfAttention> heads()',
        '''
    public List<CausalSelfAttention> heads() { return heads; }
    public DenseLayer outputProjection() { return outputProjection; }
'''),
    'transformer/TransformerBlock.java': (
        'private final LayerNormalization attentionNorm;',
        'public LayerNormalization attentionNorm()',
        '''
    public LayerNormalization attentionNorm() { return attentionNorm; }
    public MultiHeadAttention attention() { return attention; }
    public LayerNormalization feedForwardNorm() { return feedForwardNorm; }
    public FeedForwardNetwork feedForward() { return feedForward; }
'''),
    'model/JarvisLanguageModel.java': (
        'private final CharTokenizer tokenizer;',
        'public CharTokenizer tokenizer()',
        '''
    // Components are shared with the trainer; parameters update in place.
    // Do not concurrently call inference and training on the same model instance.
    public CharTokenizer tokenizer() { return tokenizer; }
    public EmbeddingLayer tokenEmbeddings() { return tokenEmbeddings; }
    public PositionalEmbedding positionalEmbeddings() { return positionalEmbeddings; }
    public List<TransformerBlock> blocks() { return blocks; }
    public LayerNormalization finalNorm() { return finalNorm; }
    public DenseLayer languageModelHead() { return languageModelHead; }
'''),
}

pending = []
for relative, (marker, method, append) in patches.items():
    target = root / base / relative
    if not target.exists():
        sys.exit(f'MISSING: {target}. Copy all LLM 10.1-10.10 changes first.')
    source = target.read_text(encoding='utf-8')
    if method in source:
        print('SKIP (already patched):', target)
        continue
    if marker not in source or not source.rstrip().endswith('}'):
        sys.exit(f'STOP: unexpected Java file structure: {target}')
    at = source.rfind('}')
    modified = source[:at] + append + '\n' + source[at:]
    pending.append((target, source, modified))

for target, original, modified in pending:
    backup = target.with_name(target.name + '.llm1011.bak')
    if not backup.exists():
        backup.write_text(original, encoding='utf-8')
    target.write_text(modified, encoding='utf-8')
    print('PATCHED:', target)
print(f'Done. Modified {len(pending)} existing Java classes.')
