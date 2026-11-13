package pl.bawar.jarvis.voice;

import static org.junit.jupiter.api.Assertions.*;
import org.junit.jupiter.api.Test;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicInteger;

class LocalSpeechServiceTest {
    private static byte[] wav(int samples) {
        byte[] bytes = new byte[44 + samples * 2];
        ByteBuffer b = ByteBuffer.wrap(bytes).order(ByteOrder.LITTLE_ENDIAN);
        b.put("RIFF".getBytes(StandardCharsets.US_ASCII)).putInt(bytes.length - 8);
        b.put("WAVEfmt ".getBytes(StandardCharsets.US_ASCII)).putInt(16);
        b.putShort((short)1).putShort((short)1).putInt(16000).putInt(32000);
        b.putShort((short)2).putShort((short)16).put("data".getBytes(StandardCharsets.US_ASCII));
        b.putInt(samples * 2);
        return bytes;
    }

    @Test void rejectsWrongFormatAndTooLongBeforeStartingWhisper() {
        LocalSpeechService svc = new LocalSpeechService(false, null, null, (a,b,c) -> 0);
        assertThrows(IllegalArgumentException.class, () -> svc.transcribe(new byte[]{1,2}, "pl"));
        byte[] corrupt = wav(4_000); corrupt[0] = 0;
        assertThrows(IllegalArgumentException.class, () -> svc.transcribe(corrupt, "pl"));
        assertThrows(IllegalArgumentException.class, () -> svc.transcribe(wav(4_000), "de"));
        assertThrows(IllegalArgumentException.class, () -> svc.transcribe(wav(240_001), "pl"));
    }

    @Test void disabledDoesNotExecuteAnyProcess() {
        LocalSpeechService svc = new LocalSpeechService(false, null, null, (a,b,c) -> fail("No execution"));
        assertFalse(svc.status().configured());
        assertThrows(IllegalStateException.class, () -> svc.transcribe(wav(4_000), "pl"));
    }

    @Test void invokesWhisperOnlyWithExplicitArgumentsThenDeletesAudio() throws Exception {
        Path tmp = Files.createTempDirectory("voice-test-");
        Path executable = Files.writeString(tmp.resolve("whisper-cli.exe"), "fake");
        Path model = Files.writeString(tmp.resolve("ggml-base.bin"), "fake");
        AtomicInteger count = new AtomicInteger();
        LocalSpeechService svc = new LocalSpeechService(true, executable, model, (argv, dir, duration) -> {
            count.incrementAndGet();
            assertEquals(executable.toString(), argv.get(0));
            assertTrue(argv.contains("-l"));
            assertTrue(argv.contains("pl"));
            assertTrue(argv.contains("-nt"));
            assertTrue(Files.exists(dir.resolve("input.wav")));
            assertEquals(16000 * 2, ByteBuffer.wrap(Files.readAllBytes(dir.resolve("input.wav")))
                .order(ByteOrder.LITTLE_ENDIAN).getInt(28));
            Files.writeString(dir.resolve("transcript.txt"), " Cześć Jarvis ");
            return 0;
        });
        assertTrue(svc.status().configured());
        assertEquals("Cześć Jarvis", svc.transcribe(wav(4_000), "pl").text());
        assertEquals(1, count.get());
        Files.deleteIfExists(executable);
        Files.deleteIfExists(model);
        Files.deleteIfExists(tmp);
    }
}
