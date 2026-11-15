package pl.bawar.jarvis.radio;

import static org.junit.jupiter.api.Assertions.*;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;

class RadioCatalogServiceTest {
    private final ObjectMapper mapper = new ObjectMapper();

    @Test void filtersInsecureAndUnplayableStreams() {
        var root = mapper.readTree("""
            [
              {"stationuuid":"ok", "name":"Demo", "url_resolved":"https://radio.example.com/live.mp3", "codec":"MP3"},
              {"stationuuid":"bad", "name":"Bad", "url_resolved":"http://radio.example.com/live", "codec":"MP3"},
              {"stationuuid":"local", "name":"Local", "url_resolved":"https://127.0.0.1/live", "codec":"AAC"},
              {"stationuuid":"hls", "name":"HLS", "url_resolved":"https://radio.example.com/live.m3u8", "codec":"HLS"}
            ]
            """);
        var stations = RadioCatalogService.parseStations(root, "PL");
        assertEquals(1, stations.size());
        assertEquals("ok", stations.getFirst().id());
    }
    @Test void rejectsMalformedStreams() {
        assertFalse(RadioCatalogService.safeStream("file:///C:/private"));
        assertFalse(RadioCatalogService.safeStream("https://user:pass@example.com/x"));
        assertTrue(RadioCatalogService.safeStream("https://radio.example.org/a.mp3"));
    }
}
