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

    @Test void staleApplyCreatesNoBackupAndConsumesTicket() throws Exception {
        Path project = Files.createDirectory(temp.resolve("project-stale"));
        Path file = project.resolve("demo.ts");
        Files.writeString(file, "original");
        AgentControlledFileService writer = service(project);
        var draft = writer.prepare(new AgentControlledFileService.PrepareRequest(
            "demo.ts", "original", "proposed"));

        Files.writeString(file, "changed externally");
        var apply = new AgentControlledFileService.ApplyRequest(
            draft.ticket(), "ZAPISZ");

        assertEquals("FILE_CHANGED",
            assertThrows(IllegalStateException.class,
                () -> writer.apply(apply)).getMessage());
        assertEquals("changed externally", Files.readString(file));
        assertFalse(Files.exists(temp.resolve("backups")));
        assertEquals("TICKET_EXPIRED",
            assertThrows(IllegalStateException.class,
                () -> writer.apply(apply)).getMessage());
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

    @Test void backupDirectoryInsideWorkspaceIsRejected() throws Exception {
        Path project = Files.createDirectory(temp.resolve("unsafe-project"));
        Path file = project.resolve("demo.ts");
        Files.writeString(file, "old");

        AgentControlledFileService writer =
            new AgentControlledFileService(
                project.toAbsolutePath().toString(),
                true,
                project.resolve("backups")
            );

        var draft = writer.prepare(
            new AgentControlledFileService.PrepareRequest(
                "demo.ts", "old", "new"
            )
        );

        assertEquals("BACKUP_DIRECTORY_UNSAFE",
            assertThrows(IllegalArgumentException.class,
                () -> writer.apply(
                    new AgentControlledFileService.ApplyRequest(
                        draft.ticket(), "ZAPISZ"
                    )
                )
            ).getMessage()
        );

        assertEquals("old", Files.readString(file));
        assertFalse(Files.exists(project.resolve("backups")));
    }

    @Test void modifiedBackupCannotBeUsedForRollback() throws Exception {
        Path project = Files.createDirectory(temp.resolve("tamper-project"));
        Path file = project.resolve("demo.ts");
        Files.writeString(file, "original");

        AgentControlledFileService writer = service(project);

        var draft = writer.prepare(
            new AgentControlledFileService.PrepareRequest(
                "demo.ts", "original", "proposed"
            )
        );

        var deployment = writer.apply(
            new AgentControlledFileService.ApplyRequest(
                draft.ticket(), "ZAPISZ"
            )
        );

        Path backup = temp.resolve("backups")
            .resolve(deployment.deploymentId() + ".orig");

        assertTrue(Files.isRegularFile(backup));
        Files.writeString(backup, "tampered");

        assertEquals("BACKUP_CHANGED",
            assertThrows(IllegalStateException.class,
                () -> writer.rollback(
                    new AgentControlledFileService.RollbackRequest(
                        deployment.deploymentId(), "COFNIJ"
                    )
                )
            ).getMessage()
        );

        assertEquals("proposed", Files.readString(file));
    }


    @Test void symlinkedBackupCannotBeUsedForRollback() throws Exception {
        Path project = Files.createDirectory(temp.resolve("symlink-project"));
        Path file = project.resolve("demo.ts");
        Files.writeString(file, "original");

        AgentControlledFileService writer = service(project);
        var draft = writer.prepare(
            new AgentControlledFileService.PrepareRequest(
                "demo.ts", "original", "proposed"
            )
        );
        var deployment = writer.apply(
            new AgentControlledFileService.ApplyRequest(
                draft.ticket(), "ZAPISZ"
            )
        );

        Path backup = temp.resolve("backups")
            .resolve(deployment.deploymentId() + ".orig");
        Path external = temp.resolve("external-backup.ts");
        Files.writeString(external, "original");

        Files.delete(backup);
        try {
            Files.createSymbolicLink(backup, external);
        } catch (UnsupportedOperationException | java.io.IOException |
                 SecurityException ex) {
            org.junit.jupiter.api.Assumptions.assumeTrue(
                false, "Symbolic links unavailable: " + ex.getMessage()
            );
        }

        // The external file has the correct hash. The rollback must still
        // reject it because the backup path is a symbolic link.
        var error = assertThrows(IllegalStateException.class,
            () -> writer.rollback(
                new AgentControlledFileService.RollbackRequest(
                    deployment.deploymentId(), "COFNIJ"
                )
            )
        );

        assertEquals("BACKUP_CHANGED", error.getMessage());
        assertEquals("proposed", Files.readString(file));
        assertEquals("original", Files.readString(external));
    }


    @Test void symlinkedBackupParentIsRejectedBeforeDirectoryCreation() throws Exception {
        Path project = Files.createDirectory(temp.resolve("linked-project"));
        Path file = project.resolve("demo.ts");
        Files.writeString(file, "original");

        Path alias = temp.resolve("backup-parent-link");
        try {
            Files.createSymbolicLink(alias, project);
        } catch (UnsupportedOperationException | java.io.IOException |
                 SecurityException ex) {
            org.junit.jupiter.api.Assumptions.assumeTrue(
                false, "Symbolic links unavailable: " + ex.getMessage()
            );
        }

        Path backupRoot = alias.resolve("agent-backups");
        AgentControlledFileService writer =
            new AgentControlledFileService(
                project.toAbsolutePath().toString(),
                true,
                backupRoot
            );

        var draft = writer.prepare(
            new AgentControlledFileService.PrepareRequest(
                "demo.ts", "original", "proposed"
            )
        );

        var error = assertThrows(IllegalArgumentException.class,
            () -> writer.apply(
                new AgentControlledFileService.ApplyRequest(
                    draft.ticket(), "ZAPISZ"
                )
            )
        );

        assertEquals("BACKUP_DIRECTORY_UNSAFE", error.getMessage());
        assertEquals("original", Files.readString(file));

        // No backup directory should have been created through the link.
        assertFalse(Files.exists(project.resolve("agent-backups")));
    }


    @Test void incompleteBackupMetadataCannotBeRolledBack() throws Exception {
        Path project = Files.createDirectory(temp.resolve("incomplete-project"));
        Path file = project.resolve("demo.ts");
        Files.writeString(file, "original");

        AgentControlledFileService writer = service(project);
        var draft = writer.prepare(
            new AgentControlledFileService.PrepareRequest(
                "demo.ts", "original", "proposed"
            )
        );
        var deployment = writer.apply(
            new AgentControlledFileService.ApplyRequest(
                draft.ticket(), "ZAPISZ"
            )
        );

        Path metadata = temp.resolve("backups")
            .resolve(deployment.deploymentId() + ".properties");

        java.util.Properties props = new java.util.Properties();
        try (var input = Files.newInputStream(metadata)) {
            props.load(input);
        }
        props.remove("afterSha256");
        try (var output = Files.newOutputStream(metadata)) {
            props.store(output, "incomplete test record");
        }

        var error = assertThrows(IllegalArgumentException.class,
            () -> writer.rollback(
                new AgentControlledFileService.RollbackRequest(
                    deployment.deploymentId(), "COFNIJ"
                )
            )
        );

        assertEquals("INVALID_BACKUP_RECORD", error.getMessage());
        assertEquals("proposed", Files.readString(file));
    }

    @Test void unsafePathInBackupMetadataCannotBeRolledBack() throws Exception {
        Path project = Files.createDirectory(temp.resolve("metadata-project"));
        Path file = project.resolve("demo.ts");
        Files.writeString(file, "original");

        AgentControlledFileService writer = service(project);
        var draft = writer.prepare(
            new AgentControlledFileService.PrepareRequest(
                "demo.ts", "original", "proposed"
            )
        );
        var deployment = writer.apply(
            new AgentControlledFileService.ApplyRequest(
                draft.ticket(), "ZAPISZ"
            )
        );

        Path metadata = temp.resolve("backups")
            .resolve(deployment.deploymentId() + ".properties");

        java.util.Properties props = new java.util.Properties();
        try (var input = Files.newInputStream(metadata)) {
            props.load(input);
        }
        props.setProperty("relativePath", "../outside.ts");
        try (var output = Files.newOutputStream(metadata)) {
            props.store(output, "unsafe path test record");
        }

        var error = assertThrows(IllegalArgumentException.class,
            () -> writer.rollback(
                new AgentControlledFileService.RollbackRequest(
                    deployment.deploymentId(), "COFNIJ"
                )
            )
        );

        assertEquals("INVALID_BACKUP_RECORD", error.getMessage());
        assertEquals("proposed", Files.readString(file));
    }


    @Test void oversizedBackupMetadataCannotBeRolledBack() throws Exception {
        Path project = Files.createDirectory(temp.resolve("oversized-project"));
        Path file = project.resolve("demo.ts");
        Files.writeString(file, "original");

        AgentControlledFileService writer = service(project);

        var draft = writer.prepare(
            new AgentControlledFileService.PrepareRequest(
                "demo.ts", "original", "proposed"
            )
        );

        var deployment = writer.apply(
            new AgentControlledFileService.ApplyRequest(
                draft.ticket(), "ZAPISZ"
            )
        );

        Path metadata = temp.resolve("backups")
            .resolve(deployment.deploymentId() + ".properties");

        Files.writeString(metadata, "oversized=" + "x".repeat(5_000));

        var exception = assertThrows(
            IllegalArgumentException.class,
            () -> writer.rollback(
                new AgentControlledFileService.RollbackRequest(
                    deployment.deploymentId(), "COFNIJ"
                )
            )
        );

        assertEquals("INVALID_BACKUP_RECORD", exception.getMessage());
        assertEquals("proposed", Files.readString(file));
    }


    @Test void metadataIsPublishedCompletelyWithoutTemporaryFiles() throws Exception {
        Path project = Files.createDirectory(temp.resolve("atomic-project"));
        Path file = project.resolve("demo.ts");
        Files.writeString(file, "original");

        AgentControlledFileService writer = service(project);
        var draft = writer.prepare(
            new AgentControlledFileService.PrepareRequest(
                "demo.ts", "original", "proposed"
            )
        );

        var deployment = writer.apply(
            new AgentControlledFileService.ApplyRequest(
                draft.ticket(), "ZAPISZ"
            )
        );

        Path backups = temp.resolve("backups");
        Path metadata = backups.resolve(
            deployment.deploymentId() + ".properties"
        );

        assertTrue(Files.isRegularFile(metadata));

        java.util.Properties properties = new java.util.Properties();
        try (var input = Files.newInputStream(metadata)) {
            properties.load(input);
        }

        assertEquals("demo.ts", properties.getProperty("relativePath"));
        assertEquals(draft.beforeSha256(),
            properties.getProperty("beforeSha256"));
        assertEquals(draft.afterSha256(),
            properties.getProperty("afterSha256"));
        assertNotNull(properties.getProperty("workspaceSha256"));
        assertNotNull(properties.getProperty("createdAt"));

        try (var entries = Files.list(backups)) {
            assertTrue(entries.noneMatch(path ->
                path.getFileName().toString().endsWith(".tmp")
            ));
        }

        assertEquals("applied", writer.history().getFirst().status());

        var rollback = writer.rollback(
            new AgentControlledFileService.RollbackRequest(
                deployment.deploymentId(), "COFNIJ"
            )
        );

        assertEquals("rolled_back", rollback.status());
        assertEquals("original", Files.readString(file));
    }


    @Test void interruptedApplyWithExternalChangeRequiresManualReview()
            throws Exception {
        Path project = Files.createDirectory(
            temp.resolve("interrupted-project")
        );
        Path file = project.resolve("demo.ts");
        Files.writeString(file, "original");

        AgentControlledFileService writer = service(project);

        var prepared = writer.prepare(
            new AgentControlledFileService.PrepareRequest(
                "demo.ts", "original", "proposed"
            )
        );

        // Simulate a crash after publishing backup metadata,
        // but before the project's file is replaced.
        Path backups = Files.createDirectories(temp.resolve("backups"));
        String deploymentId = java.util.UUID.randomUUID().toString();

        Files.writeString(
            backups.resolve(deploymentId + ".orig"),
            "original"
        );

        java.util.Properties metadata = new java.util.Properties();
        metadata.setProperty("relativePath", "demo.ts");
        metadata.setProperty("beforeSha256", prepared.beforeSha256());
        metadata.setProperty("afterSha256", prepared.afterSha256());

        byte[] rootBytes = project.toRealPath().toString().getBytes(
            java.nio.charset.StandardCharsets.UTF_8
        );

        byte[] rootHash = java.security.MessageDigest
            .getInstance("SHA-256")
            .digest(rootBytes);

        metadata.setProperty(
            "workspaceSha256",
            java.util.HexFormat.of().formatHex(rootHash)
        );
        metadata.setProperty(
            "createdAt",
            java.time.Instant.now().toString()
        );

        try (var output = Files.newOutputStream(
                backups.resolve(deploymentId + ".properties"))) {
            metadata.store(output, "Simulated interrupted apply");
        }

        // Another process edits the file before JARVIS can finish.
        Files.writeString(file, "another author's change");

        // Simulate application restart: in-memory tickets disappear.
        AgentControlledFileService restarted = service(project);

        var record = restarted.history().stream()
            .filter(item -> item.deploymentId().equals(deploymentId))
            .findFirst()
            .orElseThrow();

        assertEquals("conflicted", record.status());

        var error = assertThrows(
            IllegalStateException.class,
            () -> restarted.rollback(
                new AgentControlledFileService.RollbackRequest(
                    deploymentId, "COFNIJ"
                )
            )
        );

        assertEquals("FILE_CHANGED", error.getMessage());
        assertEquals(
            "another author's change",
            Files.readString(file)
        );
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
