"""Regression: controller startup log must not block the trainer."""
import ast
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

TRAINER = Path(__file__).resolve().parents[1] / 'train_lora.py'

class TrainerControllerCompatibilityTest(unittest.TestCase):
    def test_only_controller_log_allowed(self):
        source = TRAINER.read_text(encoding='utf-8')
        tree = ast.parse(source)
        self.assertIn('item.name != "train.log"', source)
        self.assertIn('not item.is_file()', source)

    def test_dry_run_with_existing_log_has_no_download(self):
        # Dry run must remain safe, quick, and independent of GPU/internet.
        with tempfile.TemporaryDirectory() as temp:
            output = Path(temp) / 'run'
            output.mkdir()
            (output / 'train.log').write_text('created by controller', encoding='utf-8')
            dataset = Path(temp) / 'samples.jsonl'
            dataset.write_text(''.join(json.dumps({'instruction': f'Question {i}', 'response': f'Answer {i}'})+'\n' for i in range(2)), encoding='utf-8')
            proc = subprocess.run([sys.executable, str(TRAINER), '--data', str(dataset), '--output', str(output)],
                                  capture_output=True, text=True, timeout=15)
            self.assertEqual(0, proc.returncode, proc.stdout + proc.stderr)
            self.assertIn('PREFLIGHT OK', proc.stdout)
            self.assertEqual(['train.log'], [p.name for p in output.iterdir()])

if __name__ == '__main__':
    unittest.main()
