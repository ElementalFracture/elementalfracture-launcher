#!/usr/bin/env python3
"""Generate launcher registry pairs during game-patch release preparation."""
import argparse
import importlib.util
from pathlib import Path
import tempfile


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--base-registry', type=Path, required=True)
    parser.add_argument('--signature', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True,
                        help='new output directory (must not exist)')
    parser.add_argument('--ef-manifest', type=Path, action='append', required=True)
    parser.add_argument('--classic-manifest', type=Path, action='append', default=[],
                        help='optional shared mod that stays enabled in Classic')
    parser.add_argument('--dev-manifest', type=Path, action='append', default=[])
    args = parser.parse_args()
    output = args.output.resolve()
    if output.exists():
        parser.error('output must be a new directory')
    helper = Path(__file__).resolve().parent / 'mod_distribution.py'
    spec = importlib.util.spec_from_file_location('mod_distribution', helper)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    variants = [('zzzz_ElefracRegistry_P', args.ef_manifest),
                ('zzzz_ElefracClassicRegistry_P', args.classic_manifest)]
    if args.dev_manifest:
        variants.append(('zzzz_ElefracTestRegistry_P', args.dev_manifest))
    output.parent.mkdir(parents=True, exist_ok=True)
    # Publish the directory only after every variant passes manifest/pak validation.
    with tempfile.TemporaryDirectory(dir=output.parent) as temporary:
        staged = Path(temporary) / 'registries'
        staged.mkdir()
        for stem, manifests in variants:
            module.compose(args.base_registry, manifests, staged / (stem + '.pak'), args.signature)
        staged.rename(output)
    print(f'Launcher registries ready: {output}')


if __name__ == '__main__':
    main()
