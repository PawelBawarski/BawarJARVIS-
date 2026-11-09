package pl.bawar.jarvis.runtime;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(properties = "jarvis.model.checkpoint-file=target/test-be-11-1-jarvis.ckpt")
class JarvisModelSpringTest {
    @Autowired JarvisModelService first;
    @Autowired org.springframework.context.ApplicationContext context;

    @Test
    void shouldRegisterSingleServiceBean() {
        var second = context.getBean(JarvisModelService.class);
        assertSame(first, second);
        assertTrue(first.status().vocabularySize() > 4);
        assertEquals(128, first.status().contextLength());
    }
}
