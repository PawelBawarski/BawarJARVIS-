package pl.bawar.jarvis.brain.training;

import pl.bawar.jarvis.brain.attention.CausalSelfAttention;
import pl.bawar.jarvis.brain.attention.MultiHeadAttention;
import pl.bawar.jarvis.brain.layers.DenseLayer;
import pl.bawar.jarvis.brain.model.JarvisLanguageModel;
import pl.bawar.jarvis.brain.normalization.LayerNormalization;
import pl.bawar.jarvis.brain.transformer.TransformerBlock;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Consumer;
import java.util.function.Supplier;

/** Ordered, explicit map of every trainable tensor; never uses reflection. */
final class ModelParameterRegistry {
    private ModelParameterRegistry() { }

    record Slot(String name, Supplier<double[][]> read, Consumer<double[][]> write) {
        double[][] copy() { return read.get(); }
        void replace(double[][] values) { write.accept(values); }
    }

    static List<Slot> collect(JarvisLanguageModel model) {
        List<Slot> slots = new ArrayList<>();
        slots.add(new Slot("tokens", model.tokenEmbeddings()::weightsCopy,
                model.tokenEmbeddings()::replaceWeights));
        slots.add(new Slot("positions", model.positionalEmbeddings()::weightsCopy,
                model.positionalEmbeddings()::replaceWeights));
        for (int b = 0; b < model.blocks().size(); b++) {
            TransformerBlock block = model.blocks().get(b);
            String base = "blocks." + b;
            addNorm(slots, base + ".ln1", block.attentionNorm());
            MultiHeadAttention attention = block.attention();
            addDense(slots, base + ".attention.out", attention.outputProjection());
            for (int h = 0; h < attention.heads().size(); h++) {
                CausalSelfAttention head = attention.heads().get(h);
                String p = base + ".head." + h;
                addDense(slots, p + ".q", head.queryProjection());
                addDense(slots, p + ".k", head.keyProjection());
                addDense(slots, p + ".v", head.valueProjection());
            }
            addNorm(slots, base + ".ln2", block.feedForwardNorm());
            addDense(slots, base + ".ffn.1", block.feedForward().inputLayer());
            addDense(slots, base + ".ffn.2", block.feedForward().outputLayer());
        }
        addNorm(slots, "finalNorm", model.finalNorm());
        addDense(slots, "head", model.languageModelHead());
        return List.copyOf(slots);
    }

    /** Exact optimizer-key shapes, corresponding to AdamWModelUpdater paths. */
    static Map<String, Integer> optimizerShapes(List<Slot> slots) {
        Map<String, Integer> keys = new LinkedHashMap<>();
        for (Slot slot : slots) {
            double[][] values = slot.copy();
            if (slot.name().equals("tokens")) {
                for (int i = 1; i < values.length; i++) keys.put("tokens." + i, values[i].length);
            } else if (slot.name().equals("positions")) {
                for (int i = 0; i < values.length; i++) keys.put("positions." + i, values[i].length);
            } else if (slot.name().endsWith(".w")) {
                for (int i = 0; i < values.length; i++) keys.put(slot.name() + "." + i, values[i].length);
            } else {
                keys.put(slot.name(), values[0].length);
            }
        }
        return keys;
    }

    private static void addDense(List<Slot> slots, String name, DenseLayer layer) {
        slots.add(new Slot(name + ".w", layer::weightsCopy,
                values -> layer.replaceParameters(values, layer.biasesCopy())));
        slots.add(new Slot(name + ".b", () -> new double[][]{layer.biasesCopy()},
                values -> layer.replaceParameters(layer.weightsCopy(), values[0])));
    }

    private static void addNorm(List<Slot> slots, String name, LayerNormalization layer) {
        slots.add(new Slot(name + ".gamma", () -> new double[][]{layer.gamma()},
                values -> layer.setAffineParameters(values[0], layer.beta())));
        slots.add(new Slot(name + ".beta", () -> new double[][]{layer.beta()},
                values -> layer.setAffineParameters(layer.gamma(), values[0])));
    }
}
