package pl.bawar.jarvis.chat.api;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.nio.file.Path;

@Configuration
public class ChatBrainConfiguration {
    @Bean
    public ChatReplyEngine chatReplyEngine(@Value("${jarvis.chat.knowledge-file:}") String setting) {
        Path path = setting == null || setting.isBlank()
                ? Path.of(System.getProperty("user.home"), ".jarvis", "knowledge", "approved-qa.properties")
                : Path.of(setting);
        return new ChatReplyEngine(path.toAbsolutePath());
    }
}
