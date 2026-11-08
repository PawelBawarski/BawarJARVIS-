package pl.bawar.jarvis.brain.training;

import pl.bawar.jarvis.brain.model.JarvisLanguageModel;
import pl.bawar.jarvis.brain.model.TinyGptFactory;

import java.nio.file.Path;
import java.util.List;

/** Manual educational demo; never starts on Spring Boot startup. */
public final class CheckpointDemo {
    private CheckpointDemo() { }

    public static void main(String[] args) throws Exception {
        String corpus = "ala ma kota. ";
        JarvisLanguageModel model = TinyGptFactory.create(corpus, 42L);
        FullModelTrainer trainer = new FullModelTrainer(model, 0.005, 0.0, 1.0);
        var before = new ModelEvaluator(trainer).evaluate(List.of("ala", "ma", "kota"));
        System.out.printf("Poczatkowa strata: %.5f; perplexity: %.5f%n",
                before.meanCrossEntropy(), before.perplexity());
        for (int i = 0; i < 12; i++) trainer.trainEpoch(List.of("ala", "ma", "kota"));
        var after = new ModelEvaluator(trainer).evaluate(List.of("ala", "ma", "kota"));
        System.out.printf("Koncowa strata: %.5f; perplexity: %.5f%n",
                after.meanCrossEntropy(), after.perplexity());
        System.out.println("Generacja: " + new TextGenerator(model).generate("al", 8, 0, 42).text());
        Path checkpoint = Path.of("checkpoints", "jarvis-tiny-v1.ckpt");
        ModelCheckpoint.save(checkpoint, trainer);
        System.out.println("Checkpoint: " + checkpoint.toAbsolutePath());

        JarvisLanguageModel restored = TinyGptFactory.create(corpus, 987L);
        FullModelTrainer restoredTrainer = new FullModelTrainer(restored, 0.005, 0.0, 1.0);
        ModelCheckpoint.load(checkpoint, restoredTrainer);
        System.out.println("Po wczytaniu: " + new TextGenerator(restored).generate("al", 8, 0, 42).text());
        System.out.println("Model i stan AdamW odtworzone (zgodna architektura i slownik). ");
    }
}
