import errno
import io
import json
from contextlib import redirect_stdout
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from types import SimpleNamespace
import sys
sys.path.insert(0, str(Path(__file__).resolve().parent))
import postgres17_windows as pg


class PG17ToolTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name) / 'repo'
        (self.root / 'backend').mkdir(parents=True)
        (self.root / 'backend/pom.xml').write_text('pom')
        (self.root / 'desktop/electron').mkdir(parents=True)
        self.base = Path(self.tmp.name) / 'userdata'

    def test_project_and_state_path_are_strict(self):
        self.assertEqual(pg.root_path(self.root), self.root.resolve())
        self.assertEqual(pg.state_base({'APPDATA': str(self.base)}), self.base / 'JarvisData')
        self.assertEqual(pg.state_base({}, self.base), self.base.resolve())
        with self.assertRaises(ValueError):
            pg.state_base({})
        with self.assertRaises(ValueError):
            pg.root_path(Path(self.tmp.name))

    def test_help_documents_current_data_path_without_running_database_commands(self):
        output = io.StringIO()
        with redirect_stdout(output), self.assertRaises(SystemExit) as exit_context:
            pg.main(['--help'])
        self.assertEqual(exit_context.exception.code, 0)
        self.assertIn('APPDATA/JarvisData', output.getvalue())

    def test_default_data_path_preserves_existing_legacy_directory(self):
        legacy = self.base / 'J.A.R.V.I.S.'
        legacy.mkdir(parents=True)
        marker = legacy / 'keep.txt'
        marker.write_text('existing-user-data', encoding='utf-8')
        current = pg.state_base({'APPDATA': str(self.base)})
        self.assertEqual(current, self.base / 'JarvisData')
        self.assertFalse(current.exists())
        self.assertEqual(marker.read_text(encoding='utf-8'), 'existing-user-data')

    def test_empty_tables_or_unknown_names_fail_closed(self):
        with self.assertRaisesRegex(ValueError, 'Brak tabel'):
            pg.table_counts(lambda sql: '')
        with self.assertRaisesRegex(ValueError, 'Nietypowa'):
            pg.table_counts(lambda sql: 'x; DROP TABLE y')
        queries = []
        def fake(sql):
            queries.append(sql)
            if 'pg_tables' in sql:
                return 'chat_conversation\nflyway_schema_history'
            return '4' if 'chat_conversation' in sql else '5'
        result = pg.table_counts(fake)
        self.assertEqual(result, {'chat_conversation': 4, 'flyway_schema_history': 5})
        self.assertTrue(all('DROP' not in q for q in queries))

    def test_validate_major_blocks_wrong_version(self):
        source = Path(self.tmp.name) / 'pgsql'
        (source / 'bin').mkdir(parents=True)
        (source / 'share').mkdir()
        (source / 'share/postgres.bki').write_bytes(b'stub')
        for name in pg.BINS:
            (source / 'bin' / name).write_bytes(b'stub')
        with patch.object(pg, 'command', return_value=b'postgres (PostgreSQL) 18.1'):
            with self.assertRaisesRegex(ValueError, '17.x'):
                pg.validate_version(source)
        with patch.object(pg, 'command', return_value=b'postgres (PostgreSQL) 17.6'):
            self.assertIn('17.6', pg.validate_version(source))

    def test_state_requires_exact_manifest(self):
        f = self.base / 'postgres17'
        f.mkdir(parents=True)
        state = {'schema': pg.SCHEMA, 'major': 17, 'port': pg.PORT,
                 'database': 'jarvis_db', 'migrated': False, 'activated': False}
        pg.write_state(self.base, state)
        self.assertEqual(pg.read_state(self.base)['schema'], pg.SCHEMA)
        state['port'] = 5433
        pg.write_state(self.base, state)
        with self.assertRaisesRegex(ValueError, 'Nieobsługiwany'):
            pg.read_state(self.base)

    def test_migrate_requires_existing_cluster_and_cannot_touch_docker(self):
        with self.assertRaises(ValueError):
            pg.read_state(self.base)
        with patch.object(pg, 'require_windows', return_value=None):
            with self.assertRaisesRegex(ValueError, 'nazwa kontenera'):
                pg.migrate(self.root, self.base, 'x; docker rm all')

    def test_activate_does_not_modify_old_credentials_without_migrated_manifest(self):
        self.base.mkdir()
        old = self.base / 'backend.env'
        old.write_text('JARVIS_DB_PASSWORD=old\nJARVIS_DB_PORT=5433\n')
        state = self.base / 'postgres17'
        state.mkdir()
        pg.write_state(self.base, {'schema':pg.SCHEMA, 'major':17,'port':pg.PORT,
              'database':pg.DB_NAME,'migrated':False,'activated':False})
        with patch.object(pg, 'require_windows', return_value=None), patch.object(pg, 'verify_stage', return_value=(self.root, '17.6')):
            with self.assertRaisesRegex(ValueError, 'zweryfikowanej migracji'):
                pg.activate(self.root, self.base)
        self.assertIn('5433', old.read_text())

    def test_private_atomic_writer_and_no_silent_overwrite(self):
        out = self.base / 'postgres17' / 'state.json'
        pg.atomic_bytes(out, b'abc')
        self.assertEqual(out.read_bytes(), b'abc')
        pg.atomic_bytes(out, b'def')
        self.assertEqual(out.read_bytes(), b'def')
        self.assertFalse(any('.jarvis17-3-' in f.name for f in out.parent.iterdir()))

    def test_symlinked_private_state_is_rejected(self):
        outside = Path(self.tmp.name) / 'outside'
        outside.mkdir()
        try:
            self.base.symlink_to(outside, target_is_directory=True)
        except OSError as error:
            if error.errno in (errno.EPERM, errno.EACCES) or getattr(error, 'winerror', None) == 1314:
                self.skipTest('Windows nie pozwala tworzyć symlinków (uprawnienia systemowe).')
            raise
        except NotImplementedError:
            self.skipTest('System nie obsługuje symlinków.')
        with self.assertRaisesRegex(ValueError, 'Symlink'):
            pg.safe_tree(self.base / 'postgres17' / 'state.json')

    def test_private_state_guard_rejects_symlink_without_os_creation_privilege(self):
        with patch.object(Path, 'is_symlink', return_value=True):
            with self.assertRaisesRegex(ValueError, 'Symlink'):
                pg.safe_tree(self.base / 'postgres17' / 'state.json')

    def test_stage_does_not_replace_existing_runtime(self):
        target = self.root / 'desktop/resources/postgres'
        target.mkdir(parents=True)
        with patch.object(pg, 'require_windows', return_value=None):
            with self.assertRaisesRegex(ValueError, 'już istnieje'):
                pg.stage(self.root, Path(self.tmp.name))


if __name__ == '__main__':
    unittest.main(verbosity=2)
