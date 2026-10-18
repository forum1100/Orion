"""Numerical consistency tests for quoted BBN source figures (not physics validation)."""
import math,sys,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from simulations import bbn_lithium_reconstruction as b

class SourceArithmetic(unittest.TestCase):
 def test_historical_survival(self):
  self.assertAlmostEqual(math.exp(-1.23),0.2922925776808594,places=13)
  self.assertAlmostEqual(b.HISTORICAL_BBN_LI7*math.exp(-1.23),1.5725340679230238e-10,delta=1e-22)
 def test_window_integral_matches_corrected_audit(self):
  self.assertAlmostEqual(b.window_integral(),0.2658674319838486,places=11)
 def test_q_correction_matches_audit(self):
  x=b.reconstruct()["operator_consistency"]
  self.assertAlmostEqual(x["q_required_for_target_xi"],0.8192801480,places=7)
  self.assertAlmostEqual(x["xi_implied_by_q_sqrtE_chi_window"],1.5763838574,places=7)
 def test_historical_paper_is_not_algebraically_consistent(self):
  x=b.reconstruct()["operator_consistency"]
  self.assertGreater(x["xi_from_may_draft_q_E_chi_without_window"],20)
  self.assertGreater(abs(x["xi_from_may_draft_q_E_chi_without_window"]-1.23),20)
 def test_stock_numbers_and_triad(self):
  self.assertEqual(b.STOCK_ALTERBBN["Li7_H"],5.466171494978e-10)
  self.assertAlmostEqual(b.STOCK_ALTERBBN_TRIAD_LI7,3.841190679596e-10,delta=1e-23)
  self.assertAlmostEqual(b.reconstruct()["observed_in_source_rate_trials"]["triad_reduction_percent_computed_from_reported_abundances"],29.7280,places=3)
 def test_rejected_triad_does_not_hit_target(self):
  actual=b.STOCK_ALTERBBN_TRIAD_LI7
  fitted=b.STOCK_ALTERBBN["Li7_H"]*math.exp(-1.231)
  self.assertGreater(actual,2*fitted)
 def test_combination_subadditivity_preserved(self):
  c=b.reconstruct()["observed_in_source_rate_trials"]
  self.assertGreater(c["ABC_minus_sum_percentage_points"],2.2)
  self.assertLess(c["ABC_minus_sum_percentage_points"],2.22)
 def test_assigned_filters_not_network_output(self):
  x=b.reconstruct()
  self.assertTrue(x["not_coupled_bbn_network"])
  self.assertTrue(x["not_original_historical_executable"])
  self.assertAlmostEqual(x["source_assigned_channel_survival"][-1]["remaining_fraction"],math.exp(-1.231))

if __name__=="__main__":unittest.main()
