import hashlib
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).parent))
import package_windows_17_5 as stage


class Stage175PackagingTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name) / 'BawarJARVIS-'
        src = self.root / stage.MODEL_REL
        src.parent.mkdir(parents=True)
        src.write_bytes(b'GGUFtest-payload')
        checksum = hashlib.sha256(src.read_bytes()).hexdigest()
        mf = self.root / stage.MANIFEST
        mf.write_text(json.dumps({'schema': 'jarvis.ai17.4.v1',
                                  'files': [{'path': 'models/' + stage.GGUF,
                                             'size': len(src.read_bytes()),
                                             'sha256': checksum}]}), encoding='utf-8')
        self.dst = Path(self.temp.name) / 'LOCALAPPDATA' / 'J.A.R.V.I.S.' / 'models' / stage.GGUF
        self.expected = {'size': len(src.read_bytes()), 'sha256': checksum}

    def test_digest(self):
        self.assertEqual(stage.digest(self.root / stage.MODEL_REL), self.expected['sha256'])

    def test_missing_manifest_blocked(self):
        (self.root/stage.MANIFEST).unlink()
        with self.assertRaisesRegex(stage.Blocked, 'manifestu'):
            stage.expected_model(self.root)

    def test_manifest_enforces_size(self):
        with self.assertRaisesRegex(stage.Blocked, 'rozmiar'):
            stage.expected_model(self.root)

    def test_provision_hashes_bytes_and_preserves_existing(self):
        with patch.object(stage, 'expected_model', return_value=self.expected):
            stage.provision(self.root, destination=self.dst)
            self.assertEqual(self.dst.read_bytes(), b'GGUFtest-payload')
            stage.provision(self.root, destination=self.dst)

    def test_existing_different_model_never_overwritten(self):
        self.dst.parent.mkdir(parents=True)
        self.dst.write_bytes(b'GIFFnot-a-model')
        with patch.object(stage, 'expected_model', return_value=self.expected):
            with self.assertRaisesRegex(stage.Blocked, 'nie nadpisuję'):
                stage.provision(self.root, destination=self.dst)
        self.assertEqual(self.dst.read_bytes(), b'GIFFnot-a-model')

    def test_corrupt_input_never_committed(self):
        with patch.object(stage, 'expected_model', return_value={'size':self.expected['size'], 'sha256':'a'*64}):
            with self.assertRaisesRegex(stage.Blocked, 'skopiowanego'):
                stage.provision(self.root, destination=self.dst)
        self.assertFalse(self.dst.exists())
        self.assertEqual(list(self.dst.parent.glob('*.tmp')), [])

    def test_symlink_rejected(self):
        self.dst.parent.mkdir(parents=True)
        try:
            self.dst.symlink_to(self.root/stage.MODEL_REL)
        except OSError as exc:
            # Without Developer Mode, Windows may deny symlink creation.
            # Only WinError 1314 gets a simulated filesystem predicate.
            if sys.platform != 'win32' or getattr(exc, 'winerror', None) != 1314:
                raise
            original_is_symlink = Path.is_symlink

            def is_symlink_for_test(path):
                return path == self.dst or original_is_symlink(path)

            # Exercise the REAL provision() and no_symlink() security checks.
            with patch.object(Path, 'is_symlink', autospec=True,
                              side_effect=is_symlink_for_test):
                with patch.object(stage, 'expected_model', return_value=self.expected):
                    with self.assertRaisesRegex(stage.Blocked, 'symbolicznym'):
                        stage.provision(self.root, destination=self.dst)
            self.assertFalse(self.dst.exists())
            return
        with patch.object(stage, 'expected_model', return_value=self.expected):
            with self.assertRaisesRegex(stage.Blocked, 'symbolicznym'):
                stage.provision(self.root, destination=self.dst)

    def test_destination_requires_localappdata(self):
        with self.assertRaisesRegex(stage.Blocked, 'LOCALAPPDATA'):
            stage.model_destination({})

    def test_path_traversal_blocked(self):
        with self.assertRaisesRegex(stage.Blocked, 'poza projektem'):
            stage.path_within(self.root, '../outside')

    def test_build_stages_licenses_and_checks_artifact_only_after_builder(self):
        backend = self.root / 'backend'
        backend.mkdir()
        (backend / 'mvnw.cmd').touch()
        electron = self.root / 'desktop/electron'
        electron.mkdir(parents=True)
        (electron / 'unit.test.cjs').touch()
        with patch.object(stage.sys, 'platform', 'win32'), \
                patch.object(stage, 'verify'), \
                patch.object(stage.shutil, 'which', side_effect=lambda name: name), \
                patch.object(stage, 'locate_builder', return_value='trusted-builder.cmd'), \
                patch.object(stage, 'run') as run:
            stage.build(self.root)
        commands = [call.args[1] for call in run.call_args_list]
        license_index = next(i for i, cmd in enumerate(commands) if 'scripts/stage-llm-licenses.cjs' in cmd)
        builder_index = next(i for i, cmd in enumerate(commands) if cmd[0] == 'trusted-builder.cmd')
        artifact_index = next(i for i, cmd in enumerate(commands) if 'scripts/verify-release-artifact.cjs' in cmd)
        self.assertLess(license_index, builder_index)
        self.assertLess(builder_index, artifact_index)
        self.assertEqual(commands[artifact_index][-3:], ['--write-manifest', '--root', str(self.root)])
        self.assertIn('--publish', commands[builder_index])
        self.assertIn('never', commands[builder_index])
        self.assertFalse((self.root / 'dist/jarvis-17-5/stage17-5-build.json').exists())


if __name__ == '__main__':
    unittest.main(verbosity=2)
