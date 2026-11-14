package pl.bawar.jarvis.voice;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = {
    "JARVIS_SESSION_TOKEN=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "JARVIS_PIPER_ENABLED=false",
    "JARVIS_VOICE_ENABLED=false"
})
@AutoConfigureMockMvc
class VoiceSecurityIntegrationTest {

    private static final String TOKEN =
        "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

    private static final String INVALID_TOKEN =
        "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

    private static final String TTS = "/api/ai-lab/tts";
    private static final String STT = "/api/ai-lab/voice";

    @Autowired
    MockMvc mvc;

    @Test
    void ttsStatusRequiresAuthentication() throws Exception {
        mvc.perform(get(TTS + "/status"))
            .andExpect(status().isUnauthorized());
    }

    @Test
    void voiceStatusRequiresAuthentication() throws Exception {
        mvc.perform(get(STT + "/status"))
            .andExpect(status().isUnauthorized());
    }

    @Test
    void invalidTokenCannotAccessTts() throws Exception {
        mvc.perform(get(TTS + "/status")
                .header("X-Jarvis-Session", INVALID_TOKEN))
            .andExpect(status().isUnauthorized());
    }

    @Test
    void invalidTokenCannotAccessVoice() throws Exception {
        mvc.perform(get(STT + "/status")
                .header("X-Jarvis-Session", INVALID_TOKEN))
            .andExpect(status().isUnauthorized());
    }

    @Test
    void validSessionCanReadTtsStatus() throws Exception {
        mvc.perform(get(TTS + "/status")
                .header("X-Jarvis-Session", TOKEN))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.enabled").value(false));
    }

    @Test
    void validSessionCanReadVoiceStatus() throws Exception {
        mvc.perform(get(STT + "/status")
                .header("X-Jarvis-Session", TOKEN))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.enabled").value(false));
    }

    @Test
    void unauthenticatedTtsSynthesisIsRejected() throws Exception {
        mvc.perform(post(TTS + "/synthesize")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"text":"Hello Jarvis","language":"en"}
                    """))
            .andExpect(status().isUnauthorized());
    }

    @Test
    void unauthenticatedVoiceTranscriptionIsRejected() throws Exception {
        mvc.perform(multipart(STT + "/transcribe")
                .file("file", new byte[]{1, 2, 3, 4})
                .param("language", "pl"))
            .andExpect(status().isUnauthorized());
    }

    @Test
    void authenticatedInvalidTtsRequestReturns400() throws Exception {
        mvc.perform(post(TTS + "/synthesize")
                .header("X-Jarvis-Session", TOKEN)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"text":"","language":"pl"}
                    """))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("TTS_TEXT_INVALID"));
    }

    @Test
    void authenticatedInvalidVoiceAudioReturns400() throws Exception {
        mvc.perform(multipart(STT + "/transcribe")
                .file("file", new byte[]{1, 2, 3, 4})
                .param("language", "pl")
                .header("X-Jarvis-Session", TOKEN))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("VOICE_AUDIO_INVALID"));
    }
}
