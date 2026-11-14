package pl.bawar.jarvis.voice;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class LocalTtsControllerTest {
    private LocalPiperService piper;
    private MockMvc mvc;

    private static final String URL = "/api/ai-lab/tts/synthesize";

    @BeforeEach
    void setup() {
        piper = mock(LocalPiperService.class);
        mvc = MockMvcBuilders
            .standaloneSetup(new LocalTtsController(piper))
            .setControllerAdvice(new LocalTtsErrors())
            .build();
    }

    @Test
    void malformedJsonReturns400() throws Exception {
        mvc.perform(post(URL)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{invalid-json"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("BAD_REQUEST"));

        verifyNoInteractions(piper);
    }

    @Test
    void nullBodyReturns400() throws Exception {
        // Spring MVC rejects a JSON null @RequestBody during
        // deserialization, before invoking the controller.
        mvc.perform(post(URL)
                .contentType(MediaType.APPLICATION_JSON)
                .content("null"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("BAD_REQUEST"))
            .andExpect(jsonPath("$.message").doesNotExist());

        verifyNoInteractions(piper);
    }

    @Test
    void invalidLanguageReturnsStableCode() throws Exception {
        when(piper.synthesize("Test", "de"))
            .thenThrow(new IllegalArgumentException("TTS_LANGUAGE_INVALID"));

        mvc.perform(post(URL)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"text":"Test","language":"de"}
                    """))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("TTS_LANGUAGE_INVALID"));
    }

    @Test
    void unexpectedValidationErrorIsNotExposed() throws Exception {
        when(piper.synthesize(anyString(), anyString()))
            .thenThrow(new IllegalArgumentException(
                "Internal sensitive validation detail"));

        mvc.perform(post(URL)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"text":"Test","language":"pl"}
                    """))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("BAD_REQUEST"))
            .andExpect(jsonPath("$.message").doesNotExist());
    }

    @Test
    void unexpectedStateErrorIsNotExposed() throws Exception {
        when(piper.synthesize(anyString(), anyString()))
            .thenThrow(new IllegalStateException(
                "Internal filesystem detail"));

        mvc.perform(post(URL)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"text":"Test","language":"pl"}
                    """))
            .andExpect(status().isServiceUnavailable())
            .andExpect(jsonPath("$.code").value("TTS_UNAVAILABLE"))
            .andExpect(jsonPath("$.message").doesNotExist());
    }

    @Test
    void busyReturns429() throws Exception {
        when(piper.synthesize(anyString(), anyString()))
            .thenThrow(new LocalPiperService.Busy());

        mvc.perform(post(URL)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"text":"Test","language":"pl"}
                    """))
            .andExpect(status().isTooManyRequests())
            .andExpect(jsonPath("$.code").value("TTS_BUSY"));
    }

    @Test
    void unavailableReturns503() throws Exception {
        when(piper.synthesize(anyString(), anyString()))
            .thenThrow(new IllegalStateException("TTS_SYNTHESIS_FAILED"));

        mvc.perform(post(URL)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"text":"Test","language":"pl"}
                    """))
            .andExpect(status().isServiceUnavailable())
            .andExpect(jsonPath("$.code").value("TTS_SYNTHESIS_FAILED"));
    }

    @Test
    void successfulSynthesisReturnsWavWithoutCaching() throws Exception {
        byte[] audio = new byte[]{1, 2, 3, 4};
        when(piper.synthesize("Czesc", "pl")).thenReturn(audio);

        mvc.perform(post(URL)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"text":"Czesc","language":"pl"}
                    """))
            .andExpect(status().isOk())
            .andExpect(header().string("Content-Type", "audio/wav"))
            .andExpect(header().string("Cache-Control", "no-store"))
            .andExpect(content().bytes(audio));
    }
}
