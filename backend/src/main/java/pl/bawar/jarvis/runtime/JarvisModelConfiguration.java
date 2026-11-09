package pl.bawar.jarvis.runtime;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import pl.bawar.jarvis.brain.model.JarvisLanguageModel;
import pl.bawar.jarvis.brain.model.TinyGptFactory;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

/** One model and one trainer per Spring application context. */
@Configuration
public class JarvisModelConfiguration {

    // This defines the allowed characters, NOT training material or knowledge.
    // Changing it makes earlier checkpoints incompatible.
    private static final String VOCABULARY =
            " aąbcćdeęfghijklłmnńoópqrsśtuvwxyzźż" +
            "AĄBCĆDEĘFGHIJKLŁMNŃOÓPQRSŚTUVWXYZŹŻ" +
            "0123456789.,!?;:-_()[]{}\"'\n\r\t/@#%&+*=";

    @Bean
    public JarvisModelService jarvisModelService(
            @Value("${jarvis.model.checkpoint-file:}") String checkpointSetting) {
        Path checkpoint = checkpointSetting == null || checkpointSetting.isBlank()
                ? Path.of(System.getProperty("user.home"), ".jarvis", "checkpoints", "tiny-v1.ckpt")
                : Path.of(checkpointSetting);

        JarvisLanguageModel model = TinyGptFactory.create(VOCABULARY, 42L);
        JarvisModelService service = new JarvisModelService(
                model, checkpoint, 0.005, 0.0, 1.0);

        // Never train at startup. Restore only an existing compatible checkpoint.
        if (Files.exists(service.checkpointFile())) {
            try {
                service.loadCheckpoint();
            } catch (IOException | RuntimeException e) {
                throw new IllegalStateException(
                        "Cannot restore Jarvis checkpoint. Verify model shape, vocabulary and file: "
                                + service.checkpointFile(), e);
            }
        }
        return service;
    }
}
