package pl.bawar.jarvis.lab.dataset;

import org.junit.jupiter.api.Test;
import java.util.List;
import java.util.UUID;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class DatasetServiceTest {
    private static List<String> corpus() {
        return List.of("ala", "ma kota", "kot lubi ryby", "programowanie Java", "nauka Angulara",
                "trenowanie transformera", "zapis modelu", "walidacja tekstu", "test jednostkowy", "Spring Boot");
    }

    @Test void validatesInputAndDisallowsDuplicateSamples() {
        assertThrows(IllegalArgumentException.class, () -> DatasetService.partition(List.of("a")));
        assertThrows(IllegalArgumentException.class, () -> DatasetService.partition(List.of("a", "b", "c", "d", "a")));
        assertThrows(IllegalArgumentException.class, () -> DatasetService.partition(List.of("a", "b", "c", "d", "\u0000")));
        assertThrows(IllegalArgumentException.class, () -> DatasetService.validateName(" "));
        assertThrows(IllegalArgumentException.class, () -> DatasetService.validateName("x".repeat(81)));
    }

    @Test void splitIsReproducibleIndependentOfOriginalOrder() {
        var a = DatasetService.partition(corpus());
        var b = DatasetService.partition(corpus().reversed());
        assertEquals(a, b);
        assertEquals(8, a.training().size());
        assertEquals(2, a.validation().size());
        assertTrue(a.training().stream().noneMatch(a.validation()::contains));
        assertEquals(64, a.validationSha256().length());
        assertNotEquals(a.fullSha256(), a.validationSha256());
    }

    @Test void usesUtf8ForUnicodeAndDoesNotLosePolishLetters() {
        var p = DatasetService.partition(List.of("żółw", "zażółć gęślą jaźń", "Łódź", "żaba", "chrząszcz"));
        assertEquals(4, p.training().size());
        assertEquals(1, p.validation().size());
        assertTrue(p.training().contains("Łódź") || p.validation().contains("Łódź"));
    }

    @Test void newVersionCannotReviseUnknownDataset() {
        DatasetRepository repo = mock(DatasetRepository.class);
        UUID id = UUID.randomUUID();
        when(repo.lockAndNextVersion(id)).thenThrow(new IllegalArgumentException("Unknown dataset"));
        assertThrows(IllegalArgumentException.class, () -> new DatasetService(repo).newVersion(id, corpus()));
        verify(repo, never()).insertVersion(any(), any(), anyInt(), any());
    }
}
