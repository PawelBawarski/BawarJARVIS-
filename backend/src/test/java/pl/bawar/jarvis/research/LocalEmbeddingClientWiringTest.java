package pl.bawar.jarvis.research;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;

import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;
import org.springframework.core.env.MapPropertySource;
import tools.jackson.databind.json.JsonMapper;

class LocalEmbeddingClientWiringTest {

    @Test
    void springCreatesClientUsingConfiguredConstructorInsteadOfLookingForNoArgConstructor() {
        try (var context = new AnnotationConfigApplicationContext()) {
            context.getEnvironment().getPropertySources().addFirst(new MapPropertySource(
                "embedding-test", Map.of(
                    "JARVIS_EMBEDDINGS_ENABLED", "true",
                    "JARVIS_EMBEDDINGS_MODEL", "test-embedding-model"
                )
            ));
            context.registerBean(JsonMapper.class, () -> mock(JsonMapper.class));
            context.register(LocalEmbeddingClient.class);
            context.refresh();

            var client = context.getBean(LocalEmbeddingClient.class);
            assertTrue(client.enabled());
            assertEquals("test-embedding-model", client.model());
        }
    }
}
