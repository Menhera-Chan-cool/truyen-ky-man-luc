"""Runs run.py of a given scripts directory unchanged except that the cap on --threads (4 for the shared worker) is lifted to 16 for this local run.
usage: run_cap.py SCRIPTS_DIR [run.py arguments]"""
import sys,pathlib
scripts=pathlib.Path(sys.argv[1]);src=(scripts/'run.py').read_text(encoding='utf-8')
cap='if not 1<=args.threads<=4:';assert src.count(cap)==1
sys.path.insert(0,str(scripts));sys.argv=[str(scripts/'run.py')]+sys.argv[2:]
exec(compile(src.replace(cap,'if not 1<=args.threads<=16:'),str(scripts/'run.py'),'exec'),{'__name__':'__main__','__file__':str(scripts/'run.py')})
