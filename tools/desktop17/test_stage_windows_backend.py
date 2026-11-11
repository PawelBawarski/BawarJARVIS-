import json
import tempfile
import unittest
import zipfile
from pathlib import Path
from unittest.mock import patch

import stage_windows_backend as stage


class Stage17_2Tests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        (self.root / 'backend' / 'target').mkdir(parents=True)
        (self.root / 'backend' / 'pom.xml').write_text('<project/>')
        (self.root / 'desktop' / 'electron').mkdir(parents=True)
        (self.root / 'desktop' / 'electron' / 'backend-runtime.cjs').write_text('// runtime')

    def tearDown(self):
        self.temp.cleanup()

    def fake_jdk(self, version='21.0.13'):
        jdk = self.root / 'jdk'
        (jdk / 'bin').mkdir(parents=True)
        (jdk / 'legal' / 'java.base').mkdir(parents=True)
        (jdk / 'bin' / 'java.exe').write_bytes(b'java')
        (jdk / 'bin' / 'jlink.exe').write_bytes(b'jlink')
        (jdk / 'release').write_text(f'JAVA_VERSION="{version}"\nIMPLEMENTOR="Eclipse Adoptium"\n')
        return jdk

    def fake_jar(self, name='backend.jar', boot=True):
        jar = self.root / 'backend' / 'target' / name
        with zipfile.ZipFile(jar, 'w') as z:
            z.writestr('META-INF/MANIFEST.MF', 'Main-Class: org.springframework.boot.loader.launch.JarLauncher\nStart-Class: pl.bawar.jarvis.BackendApplication\n')
            if boot:
                z.writestr('BOOT-INF/lib/a.jar', 'x')
        return jar

    def test_java_21_release(self):
        self.assertEqual(stage.java_release(self.fake_jdk())['JAVA_VERSION'], '21.0.13')

    def test_reject_wrong_java_version(self):
        with self.assertRaisesRegex(ValueError, 'JDK 21'):
            stage.java_release(self.fake_jdk('22.0.1'))

    def test_reject_missing_license(self):
        jdk = self.fake_jdk()
        (jdk / 'legal' / 'java.base').rmdir()
        with self.assertRaisesRegex(ValueError, 'licencyjn'):
            stage.java_release(jdk)

    def test_only_valid_boot_jar(self):
        expected = self.fake_jar()
        self.fake_jar('ordinary.jar', boot=False)
        self.assertEqual(stage.choose_boot_jar(self.root), expected)

    def test_reject_ambiguous_boot_jar(self):
        self.fake_jar('backend.jar')
        self.fake_jar('other.jar')
        with self.assertRaisesRegex(ValueError, 'jednego'):
            stage.choose_boot_jar(self.root)

    def test_verify_detects_hash_tampering(self):
        self.fake_jar()
        resources = self.root / 'desktop' / 'resources'
        java = resources / 'java' / 'bin' / 'java.exe'
        java.parent.mkdir(parents=True)
        java.write_bytes(b'java-exe')
        (resources / 'java' / 'legal' / 'java.base').mkdir(parents=True)
        (resources / 'java' / 'release').write_text('JAVA_VERSION="21.0.13"\n')
        jar = resources / 'backend' / 'jarvis-backend.jar'
        jar.parent.mkdir(parents=True)
        jar.write_bytes((self.root / 'backend' / 'target' / 'backend.jar').read_bytes())
        manifest = {
            'schema': 'jarvis.windows17.backend.v1',
            'sha256_java': stage.hash_file(java),
            'sha256_jar': stage.hash_file(jar),
        }
        (jar.parent / 'stage17-2-manifest.json').write_text(json.dumps(manifest))
        stage.verify_bundle(self.root, run_java=False)
        jar.write_bytes(b'changed')
        with self.assertRaisesRegex(ValueError, 'SHA-256'):
            stage.verify_bundle(self.root, run_java=False)

    def test_prepare_refuses_non_windows_without_side_effects(self):
        jdk = self.fake_jdk()
        with patch.object(stage.sys, 'platform', 'linux'):
            with self.assertRaisesRegex(ValueError, 'Windows'):
                stage.prepare(self.root, jdk, True, False)
        self.assertFalse((self.root / 'desktop' / 'resources').exists())

    def test_prepare_stages_complete_runtime_and_jar_atomically(self):
        self.fake_jar()
        jdk = self.fake_jdk()
        def fake_run_checked(args, cwd):
            self.assertIn('jlink.exe', args[0])
            output = Path(args[args.index('--output') + 1])
            (output / 'bin').mkdir(parents=True)
            (output / 'bin' / 'java.exe').write_bytes(b'windows-exe')
            (output / 'legal' / 'java.base').mkdir(parents=True)
            (output / 'release').write_text('JAVA_VERSION="21.0.13"\n')
        class Result:
            returncode = 0
            stderr = 'openjdk version "21.0.13"'
            stdout = ''
        with patch.object(stage.sys, 'platform', 'win32'), patch.object(stage, 'run_checked', side_effect=fake_run_checked), patch.object(stage.subprocess, 'run', return_value=Result()):
            stage.prepare(self.root, jdk, True, False)
            stage.verify_bundle(self.root, run_java=False)
        self.assertTrue((self.root / 'desktop' / 'resources' / 'backend' / 'jarvis-backend.jar').is_file())

    def test_prepare_rolls_back_after_staging_error(self):
        self.fake_jar()
        jdk = self.fake_jdk()
        with patch.object(stage.sys, 'platform', 'win32'), patch.object(stage, 'run_checked', side_effect=OSError('simulated jlink failure')):
            with self.assertRaises(OSError):
                stage.prepare(self.root, jdk, True, False)
        self.assertFalse((self.root / 'desktop' / 'resources' / 'java').exists())
        self.assertFalse((self.root / 'desktop' / 'resources' / 'backend').exists())


if __name__ == '__main__':
    unittest.main()
