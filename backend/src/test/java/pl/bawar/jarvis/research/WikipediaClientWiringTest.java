package pl.bawar.jarvis.research;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;
import tools.jackson.databind.json.JsonMapper;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

class WikipediaClientWiringTest {
    private final ApplicationContextRunner runner = new ApplicationContextRunner()
            .withUserConfiguration(WiringConfiguration.class);

    @Test
    void springCreatesWikipediaClientUsingTheJsonMapperConstructor() {
        runner.run(context -> {
            assertThat(context).hasNotFailed();
            assertThat(context).hasSingleBean(WikipediaClient.class);
        });
    }

    @Configuration(proxyBeanMethods = false)
    @Import(WikipediaClient.class)
    static class WiringConfiguration {
        @Bean
        JsonMapper jsonMapper() {
            return mock(JsonMapper.class);
        }
    }
}
