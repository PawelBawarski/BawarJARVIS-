package pl.bawar.jarvis.voice;

import static org.junit.jupiter.api.Assertions.*;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;

class LocalPiperServiceTest {
    static byte[] wav() {
        byte[] data = new byte[48];
        byte[] riff = "RIFF".getBytes(StandardCharsets.US_ASCII);
        byte[] wave = "WAVE".getBytes(StandardCharsets.US_ASCII);
        byte[] chunk = "data".getBytes(StandardCharsets.US_ASCII);
        System.arraycopy(riff, 0, data, 0, 4);
        System.arraycopy(wave, 0, data, 8, 4);
        System.arraycopy(chunk, 0, data, 36, 4);
        return data;
    }

    @Test void disabledNeverRunsNativeCode() {
        var svc = new LocalPiperService(false, null, null, null, (a,b,c,d) -> fail("Never execute"));
        assertFalse(svc.status().enabled());
        assertThrows(IllegalArgumentException.class, () -> svc.synthesize("", "pl"));
        assertThrows(IllegalArgumentException.class, () -> svc.synthesize("hello", "fr"));
        assertThrows(IllegalArgumentException.class, () -> svc.synthesize("a".repeat(1201), "pl"));
        assertThrows(IllegalStateException.class, () -> svc.synthesize("hello", "pl"));
    }

    @Test void explicitInvocationUsesArgumentListNotShellAndDeletesOutput() throws Exception {
        Path temp = Files.createTempDirectory("piper-test-");
        try {
            Path binary = Files.writeString(temp.resolve("piper.exe"), "fixture");
            Path pl = Files.writeString(temp.resolve("pl.onnx"), "model");
            Path en = Files.writeString(temp.resolve("en.onnx"), "model");
            Files.writeString(Path.of(pl + ".json"), "{}");
            Files.writeString(Path.of(en + ".json"), "{}");
            AtomicInteger count = new AtomicInteger();
            LocalPiperService svc = new LocalPiperService(true, binary, pl, en, (argv, text, dir, timeout) -> {
                count.incrementAndGet();
                assertEquals(binary.toString(), argv.get(0));
                assertEquals(pl.toString(), argv.get(2));
                assertEquals("Hello & not-a-shell-command", text);
                assertFalse(argv.contains("cmd.exe"));
                Files.write(dir.resolve("speech.wav"), wav());
                return 0;
            });
            assertTrue(svc.status().configuredPl());
            assertTrue(svc.status().configuredEn());
            assertEquals(48, svc.synthesize("Hello & not-a-shell-command", "pl").length);
            assertEquals(1, count.get());
        } finally {
            try (var files = Files.walk(temp)) {
                for (Path file : files.sorted(java.util.Comparator.reverseOrder()).toList()) Files.deleteIfExists(file);
            }
        }
    }

    @Test void rejectsWrongWavOutput() throws Exception {
        Path temp = Files.createTempDirectory("piper-invalid-");
        try {
            Path binary = Files.writeString(temp.resolve("piper.exe"), "fixture");
            Path pl = Files.writeString(temp.resolve("pl.onnx"), "model");
            Files.writeString(Path.of(pl + ".json"), "{}");
            LocalPiperService svc = new LocalPiperService(true, binary, pl, null, (argv, text, dir, timeout) -> {
                Files.write(dir.resolve("speech.wav"), new byte[50]);
                return 0;
            });
            assertThrows(IllegalStateException.class, () -> svc.synthesize("test", "pl"));
        } finally {
            try (var files = Files.walk(temp)) {
                for (Path file : files.sorted(java.util.Comparator.reverseOrder()).toList()) Files.deleteIfExists(file);
            }
        }
    }
}
