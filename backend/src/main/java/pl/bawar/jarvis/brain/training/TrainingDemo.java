package pl.bawar.jarvis.brain.training;

import pl.bawar.jarvis.brain.model.JarvisLanguageModel;
import pl.bawar.jarvis.brain.model.TinyGptFactory;

import java.util.List;

/** Manual educational training demo; never starts on Spring Boot startup. */
public final class TrainingDemo {
    private TrainingDemo() { }

    public static void main(String[] args) {
        // Vocabulary is derived from this text: every training character must be known.
        JarvisLanguageModel model = TinyGptFactory.create("ala ma kota. ", 42L);
        FullModelTrainer trainer = new FullModelTrainer(model, 0.005, 0.0, 1.0);
        List<String> examples = List.of("ala", "ma", "kota", "ala ma kota");

        System.out.printf("Poczatkowy loss ('ala'): %.6f%n", trainer.evaluateExample("ala"));
        System.out.println("Predykcja przed: " + model.predictNextToken("al"));

        for (int epoch = 1; epoch <= 50; epoch++) {
            double trainingLoss = trainer.trainEpoch(examples);
            if (epoch == 1 || epoch % 10 == 0) {
                System.out.printf("Epoka %d | sredni loss przed krokami = %.6f%n",
                        epoch, trainingLoss);
            }
        }

        System.out.printf("Koncowy loss ('ala'): %.6f%n", trainer.evaluateExample("ala"));
        System.out.println("Predykcja po: " + model.predictNextToken("al"));
        System.out.println("Uwaga: taki maly korpus prowadzi do przeuczenia, nie do rozmownego LLM.");
    }
}
