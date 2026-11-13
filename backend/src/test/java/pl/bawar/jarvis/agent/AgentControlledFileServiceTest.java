package pl.bawar.jarvis.agent;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import java.nio.file.Files;
import java.nio.file.Path;
import static org.junit.jupiter.api.Assertions.*;

class AgentControlledFileServiceTest {
    @TempDir Path temp;
    private AgentControlledFileService service(Path project) {
        return new AgentControlledFileService(project.toAbsolutePath().toString(), true, temp.resolve("backups"));
    }
    @Test void optInIsRequired() throws Exception {
        AgentControlledFileService disabled = new AgentControlledFileService("", false, temp.resolve("backup"));
        assertFalse(disabled.status().enabled());
        assertThrows(IllegalStateException.class, () -> disabled.prepare(new AgentControlledFileService.PrepareRequest("a.ts", "a", "b")));
    }
    @Test void fullFileApplyAndRollbackSurviveRestart() throws Exception {
        Path project = Files.createDirectory(temp.resolve("project"));
        Path file = project.resolve("demo.ts");
        Files.writeString(file, "export const old = 1;\n");
        AgentControlledFileService service = service(project);
        var pre = service.prepare(new AgentControlledFileService.PrepareRequest("demo.ts", "export const old = 1;\n", "export const old = 2;\n"));
        assertEquals("export const old = 1;\n", Files.readString(file));
        assertThrows(IllegalArgumentException.class, () -> service.apply(new AgentControlledFileService.ApplyRequest(pre.ticket(), "YES")));
        var result = service.apply(new AgentControlledFileService.ApplyRequest(pre.ticket(), "ZAPISZ"));
        assertEquals("applied", result.status());
        assertEquals("export const old = 2;\n", Files.readString(file));
        assertThrows(IllegalStateException.class, () -> service.apply(new AgentControlledFileService.ApplyRequest(pre.ticket(), "ZAPISZ")));
        AgentControlledFileService restart = service(project);
        assertEquals("applied", restart.history().getFirst().status());
        var rollback = restart.rollback(new AgentControlledFileService.RollbackRequest(result.deploymentId(), "COFNIJ"));
        assertEquals("rolled_back", rollback.status());
        assertEquals("export const old = 1;\n", Files.readString(file));
        assertEquals("rolled_back", restart.history().getFirst().status());
    }
    @Test void staleFileAndUnsupportedPathsNeverWrite() throws Exception {
        Path project = Files.createDirectory(temp.resolve("project"));
        Path file = project.resolve("demo.ts");
        Files.writeString(file, "alpha");
        AgentControlledFileService service = service(project);
        assertThrows(IllegalArgumentException.class, () -> service.prepare(new AgentControlledFileService.PrepareRequest("../secret.ts", "alpha", "beta")));
        assertThrows(IllegalArgumentException.class, () -> service.prepare(new AgentControlledFileService.PrepareRequest(".env", "alpha", "beta")));
        assertThrows(IllegalStateException.class, () -> service.prepare(new AgentControlledFileService.PrepareRequest("demo.ts", "partial", "beta")));
        var pre = service.prepare(new AgentControlledFileService.PrepareRequest("demo.ts", "alpha", "beta"));
        Files.writeString(file, "user changed");
        assertThrows(IllegalStateException.class, () -> service.apply(new AgentControlledFileService.ApplyRequest(pre.ticket(), "ZAPISZ")));
        assertEquals("user changed", Files.readString(file));
    }
    @Test void rollbackCannotOverwriteNewerWork() throws Exception {
        Path project = Files.createDirectory(temp.resolve("project"));
        Path file = project.resolve("demo.ts");
        Files.writeString(file, "old");
        AgentControlledFileService service = service(project);
        var pre = service.prepare(new AgentControlledFileService.PrepareRequest("demo.ts", "old", "new"));
        var changed = service.apply(new AgentControlledFileService.ApplyRequest(pre.ticket(), "ZAPISZ"));
        Files.writeString(file, "other author");
        assertThrows(IllegalStateException.class, () -> service.rollback(new AgentControlledFileService.RollbackRequest(changed.deploymentId(), "COFNIJ")));
        assertEquals("other author", Files.readString(file));
    }
    @Test void symlinksCannotEscapeWorkspace() throws Exception {
        Path project = Files.createDirectory(temp.resolve("project"));
        Path external = temp.resolve("outside.ts");Files.writeString(external,"old");
        try { Files.createSymbolicLink(project.resolve("escape.ts"),external); }
        catch (UnsupportedOperationException | java.nio.file.FileSystemException e) { return; }
        assertThrows(IllegalArgumentException.class, () -> service(project).prepare(new AgentControlledFileService.PrepareRequest("escape.ts", "old", "evil")));
        assertEquals("old", Files.readString(external));
    }
}
