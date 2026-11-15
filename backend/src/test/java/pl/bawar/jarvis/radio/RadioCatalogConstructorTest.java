package pl.bawar.jarvis.radio;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import tools.jackson.databind.ObjectMapper;

class RadioCatalogConstructorTest {
    @Test
    void publicDependencyInjectionConstructorIsExplicitlyAnnotated() throws Exception {
        var constructor = RadioCatalogService.class.getConstructor(ObjectMapper.class);
        assertNotNull(constructor.getAnnotation(Autowired.class),
                "Spring must know which of the two constructors to use");
        assertEquals(2, RadioCatalogService.class.getDeclaredConstructors().length);
    }
}
