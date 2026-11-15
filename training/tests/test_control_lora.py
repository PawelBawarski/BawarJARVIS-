import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

SOURCE = Path(__file__).resolve().parents[1] / 'control_lora.py'
spec = importlib.util.spec_from_file_location('control_lora', SOURCE)
ctrl = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ctrl)


class ControllerTest(unittest.TestCase):
    def test_empty_status(self):
        with tempfile.TemporaryDirectory() as td, patch.object(ctrl, 'RUNS', Path(td)), \
             patch.object(ctrl, 'CURRENT', Path(td) / 'active-run.json'):
            self.assertIsNone(ctrl.state())

    def test_persisted_finished_status(self):
        with tempfile.TemporaryDirectory() as td, patch.object(ctrl, 'RUNS', Path(td)), \
             patch.object(ctrl, 'CURRENT', Path(td) / 'active-run.json'), patch.object(ctrl, 'alive', return_value=False):
            root = Path(td)
            (root / 'x').mkdir()
            ctrl.atomic_json(root / 'active-run.json', {'pid': 42, 'runId': 'x', 'steps': 6})
            ctrl.atomic_json(root / 'x' / 'progress.json', {'status': 'completed', 'step': 6, 'loss': 0.5})
            state = ctrl.state()
            self.assertEqual('completed', state['status'])
            self.assertEqual(6, state['step'])

    def test_stop_creates_flag_only_when_live(self):
        with tempfile.TemporaryDirectory() as td, patch.object(ctrl, 'RUNS', Path(td)), \
             patch.object(ctrl, 'CURRENT', Path(td) / 'active-run.json'), patch.object(ctrl, 'alive', return_value=True):
            root = Path(td)
            (root / 'x').mkdir()
            ctrl.atomic_json(root / 'active-run.json', {'pid': 42, 'runId': 'x', 'steps': 6})
            self.assertEqual(0, ctrl.stop())
            self.assertTrue((root / 'x' / 'STOP').exists())

    def test_invalid_steps_rejected_before_process(self):
        with self.assertRaises(ValueError):
            ctrl.start(0, 128)
        with self.assertRaises(ValueError):
            ctrl.start(6, 8)


if __name__ == '__main__':
    unittest.main()
