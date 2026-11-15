package pl.bawar.jarvis.radio;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class RadioFavoritesValidationTest {
    @Test void acceptsSafeStation() {
        assertDoesNotThrow(() -> RadioFavoritesController.validate(new RadioFavoritesController.Favorite(
            "station-1", "Demo FM", "PL", "https://radio.example.org/live.mp3")));
    }
    @Test void rejectsLocalAndInsecureStreams() {
        for (String url : new String[]{"http://radio.example.org/live", "https://127.0.0.1/private", "file:///etc/passwd"}) {
            assertThrows(IllegalArgumentException.class, () -> RadioFavoritesController.validate(
                new RadioFavoritesController.Favorite("station-1", "Demo", "PL", url)));
        }
    }
    @Test void rejectsInvalidMetadata() {
        assertThrows(IllegalArgumentException.class, () -> RadioFavoritesController.validate(
            new RadioFavoritesController.Favorite("", "Demo", "PL", "https://radio.example.org/live")));
        assertThrows(IllegalArgumentException.class, () -> RadioFavoritesController.validate(
            new RadioFavoritesController.Favorite("station-1", "Demo", "ZZ", "https://radio.example.org/live")));
    }
}
