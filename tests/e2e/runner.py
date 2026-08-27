"""
CLI Multi-Tier Test Runner for Omnichannel POS and Inventory Management System E2E Suite.
Supports:
    python tests/e2e/runner.py --all
    python tests/e2e/runner.py --tier 1
    python tests/e2e/runner.py --tier 2
    python tests/e2e/runner.py --tier 3
    python tests/e2e/runner.py --tier 4
"""

import sys
import os
import argparse
import time
from pathlib import Path


# ANSI Color formatting
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
CYAN = "\033[96m"
BOLD = "\033[1m"
RESET = "\033[0m"


TIER_MAP = {
    "1": {
        "name": "Tier 1: Feature Coverage (Isolation)",
        "path": "tests/e2e/tier1_features",
        "description": "Cartesian variants, 2-tier barcode scan, checkout, payments, restock, loyalty, expenses, error envelopes"
    },
    "2": {
        "name": "Tier 2: Boundary & Corner Cases (Negative)",
        "path": "tests/e2e/tier2_boundary",
        "description": "Overselling rejection, uniqueness, malformed UUIDs, decimal precision, restock state machine, soft-deletes"
    },
    "3": {
        "name": "Tier 3: Cross-Feature Combinations (Pairwise)",
        "path": "tests/e2e/tier3_combinations",
        "description": "Catalog->Scan->Cart->Checkout->Ledger, Idempotency replays, Restock->Sale->Loyalty->Expense, Omnichannel shared stock"
    },
    "4": {
        "name": "Tier 4: Realistic Omnichannel Workloads",
        "path": "tests/e2e/tier4_workloads",
        "description": "Retail day lifecycle, high-velocity flash sale, cashier shift reconciliation, offline sync replay, loyalty tiers"
    }
}


def print_banner():
    print(f"\n{BOLD}{CYAN}================================================================================{RESET}")
    print(f"{BOLD}{CYAN}      OMNICHANNEL POS & INVENTORY SYSTEM - E2E AUTOMATED TEST RUNNER            {RESET}")
    print(f"{BOLD}{CYAN}================================================================================{RESET}\n")


def run_tier(tier_key: str, verbose: bool = False, extra_args: list = None) -> int:
    import pytest
    tier_info = TIER_MAP[tier_key]
    tier_path = tier_info["path"]
    tier_name = tier_info["name"]

    print(f"{BOLD}{YELLOW}>>> Running {tier_name}...{RESET}")
    print(f"    Scope: {tier_info['description']}")
    print(f"    Path:  {tier_path}\n")

    pytest_args = [
        tier_path,
        "-v" if verbose else "-q",
        "--tb=short",
    ]
    if extra_args:
        pytest_args.extend(extra_args)

    start_time = time.time()
    exit_code = pytest.main(pytest_args)
    elapsed = time.time() - start_time

    status_str = f"{GREEN}PASSED{RESET}" if exit_code == 0 else f"{RED}FAILED{RESET}"
    print(f"\n{BOLD}Tier Result:{RESET} {status_str} ({elapsed:.2f}s)\n")
    return exit_code


def main():
    parser = argparse.ArgumentParser(description="E2E Test Runner for POS & Inventory System")
    parser.add_argument("--tier", choices=["1", "2", "3", "4"], help="Run specific test tier")
    parser.add_argument("--all", action="store_true", help="Run all 4 test tiers (default)")
    parser.add_argument("-v", "--verbose", action="store_true", help="Verbose pytest output")
    parser.add_argument("-k", "--filter", help="Expression to filter test names")

    args, unknown = parser.parse_known_args()

    # Ensure workspace root is in sys.path
    workspace_root = str(Path(__file__).resolve().parent.parent.parent)
    if workspace_root not in sys.path:
        sys.path.insert(0, workspace_root)

    print_banner()

    extra_args = []
    if args.filter:
        extra_args.extend(["-k", args.filter])
    if unknown:
        extra_args.extend(unknown)

    tiers_to_run = []
    if args.tier:
        tiers_to_run = [args.tier]
    else:
        tiers_to_run = ["1", "2", "3", "4"]

    overall_start = time.time()
    results = {}

    for t in tiers_to_run:
        code = run_tier(t, verbose=args.verbose, extra_args=extra_args)
        results[t] = code

    overall_elapsed = time.time() - overall_start

    # Summary Table
    print(f"{BOLD}{CYAN}================================================================================{RESET}")
    print(f"{BOLD}{CYAN}                              TEST SUITE SUMMARY                                {RESET}")
    print(f"{BOLD}{CYAN}================================================================================{RESET}")

    all_passed = True
    for t in tiers_to_run:
        tier_info = TIER_MAP[t]
        passed = results[t] == 0
        if not passed:
            all_passed = False
        tag = f"{GREEN}[PASS]{RESET}" if passed else f"{RED}[FAIL]{RESET}"
        print(f"  {tag} {tier_info['name']}")

    print(f"\n{BOLD}Total Execution Time:{RESET} {overall_elapsed:.2f}s")

    if all_passed:
        print(f"\n{BOLD}{GREEN}[SUCCESS] ALL TEST SUITES PASSED CLEANLY! (100% SUCCESS){RESET}\n")
        return 0
    else:
        print(f"\n{BOLD}{RED}[FAILURE] SOME TEST SUITES FAILED! Check logs above.{RESET}\n")
        return 1


if __name__ == "__main__":
    sys.exit(main())
