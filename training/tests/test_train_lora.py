from __future__ import annotations
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[1] / 'train_lora.py'


class TrainerSmokeTest(unittest.TestCase):
    def test_dry_run_does_not_download_or_write(self):
        with tempfile.TemporaryDirectory() as td:
            dataset = Path(td) / 'data.jsonl'
            dataset.write_text('\n'.join(json.dumps({'instruction':'A?', 'response':'B.'}) for _ in range(2)), encoding='utf8')
            output = Path(td) / 'model'
            r = subprocess.run([sys.executable, str(SCRIPT), '--data', str(dataset), '--output', str(output)], capture_output=True, text=True)
            self.assertEqual(r.returncode, 0, r.stderr)
            self.assertIn('PREFLIGHT OK', r.stdout)
            self.assertFalse(output.exists())

    def test_reject_bad_dataset(self):
        with tempfile.TemporaryDirectory() as td:
            dataset = Path(td) / 'bad.jsonl'
            dataset.write_text('{bad}', encoding='utf8')
            r = subprocess.run([sys.executable, str(SCRIPT), '--data', str(dataset)], capture_output=True, text=True)
            self.assertNotEqual(r.returncode, 0)
            self.assertIn('Błędny JSONL', r.stderr)

    def test_reject_invalid_steps(self):
        r = subprocess.run([sys.executable, str(SCRIPT), '--steps', '0'], capture_output=True, text=True)
        self.assertNotEqual(r.returncode, 0)


if __name__ == '__main__':
    unittest.main()
