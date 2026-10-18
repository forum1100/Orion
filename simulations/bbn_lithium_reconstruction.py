"""Reproduce source-reported DT/AlterBBN lithium numbers, WITHOUT running AlterBBN.

This is a new arithmetic reconstruction, NOT original May code or a coupled
nuclear network. Primary: July 14 corrected BBN audit; Sept 8 AlterBBN
successor execution in forum1100/Distel-Theory-Research/retests.
"""
from __future__ import annotations
import json,math,hashlib,sys,csv
from pathlib import Path

HISTORICAL_BBN_LI7=5.38e-10
HISTORICAL_XI_TARGET=1.23
Q_LISTED=1.05
E_LISTED=17.24
CHI_LISTED=1.36
WINDOW_CENTER=0.5
WINDOW_WIDTH=0.15
STOCK_ALTERBBN={
 "Yp":2.472892431214e-1,
 "D_H":2.434823987112e-5,
 "He3_H":1.031143037369e-5,
 "Li7_H":5.466171494978e-10,
 "Li6_H":1.072668319169e-14,
 "Be7_H":5.179861834299e-10
}
RATE_PERTURBATIONS_PERCENT={
 "R17 +20%":-11.5453,
 "R27 -20%":-20.2220,
 "R34 +20%":-0.1721,
 "R17/R27":-29.6204,
 "R17/R34":-11.6801,
 "R27/R34":-20.3595,
 "R17/R27/R34":-29.7280
}
SURVIVAL_ASSIGNED_XI={"H":0.004,"D":0.012,"He4":0.008,"Be7/Li7":1.231}
STOCK_ALTERBBN_TRIAD_LI7=3.841190679596e-10

def gaussian(t):
    return math.exp(-((t-WINDOW_CENTER)/WINDOW_WIDTH)**2)

def window_integral(start=0.0,end=1.0):
    factor=WINDOW_WIDTH*math.sqrt(math.pi)/2
    return factor*(math.erf((end-WINDOW_CENTER)/WINDOW_WIDTH)-math.erf((start-WINDOW_CENTER)/WINDOW_WIDTH))

def xi_from_listed_operator(q=Q_LISTED):
    # This q*sqrt(E)*chi expression is quoted in July 14 correction.
    # May's separate q*E*chi expression differs: do not merge them.
    return q*math.sqrt(E_LISTED)*CHI_LISTED*window_integral()

def reconstruct():
    area=window_integral()
    xi_implied=xi_from_listed_operator()
    q_required=HISTORICAL_XI_TARGET/(math.sqrt(E_LISTED)*CHI_LISTED*area)
    src_math=HISTORICAL_BBN_LI7*math.exp(-HISTORICAL_XI_TARGET)
    stock=STOCK_ALTERBBN["Li7_H"]
    out={
      "run_class":"NEW_RECOMPUTATION_OF_RECOVERED_SOURCE_NUMBERS",
      "not_original_historical_executable":True,
      "not_coupled_bbn_network":True,
      "sources":{
        "paper":"https://drive.google.com/file/d/1KgoT0DEBZym1cQGKhFwS1UO3MDVUE816/view",
        "corrected_audit":"https://docs.google.com/document/d/1cAG2YTMJXMLuFWZCsNzAAwDkNHeJyygnKVHH3PCMsTQ/edit",
        "actual_stock_successor":"https://github.com/forum1100/Distel-Theory-Research/blob/main/retests/BBN_ALTERBBN_EXECUTION_2026-09-08.md"
      },
      "original_surrogate":{
        "baseline_li7_h":HISTORICAL_BBN_LI7,
        "target_exponent_xi":HISTORICAL_XI_TARGET,
        "survival_fraction":math.exp(-HISTORICAL_XI_TARGET),
        "target_li7_h":src_math,
        "suppression_factor":math.exp(HISTORICAL_XI_TARGET)
      },
      "operator_consistency":{
        "window_type":"Gaussian on UNMAPPED normalized time 0 to 1",
        "window_center":WINDOW_CENTER,"window_width":WINDOW_WIDTH,
        "integral_0_to_1":area,
        "q_listed":Q_LISTED,"chi_listed":CHI_LISTED,"E_listed":E_LISTED,
        "xi_implied_by_q_sqrtE_chi_window":xi_implied,
        "q_required_for_target_xi":q_required,
        "integral_required_for_listed_q":HISTORICAL_XI_TARGET/(Q_LISTED*math.sqrt(E_LISTED)*CHI_LISTED),
        "xi_from_may_draft_q_E_chi_without_window":Q_LISTED*E_LISTED*CHI_LISTED,
        "status":"INCONSISTENT_PARAMETERIZATIONS_PRESERVED"
      },
      "source_assigned_channel_survival":[{"channel":k,"xi_assigned":v,"remaining_fraction":math.exp(-v),"loss_fraction":1-math.exp(-v)} for k,v in SURVIVAL_ASSIGNED_XI.items()],
      "stock_alterbbn_v2_2_reported":STOCK_ALTERBBN,
      "observed_in_source_rate_trials":{
          "one_at_a_time_and_combinations_percent":RATE_PERTURBATIONS_PERCENT,
          "triad_li7_h":STOCK_ALTERBBN_TRIAD_LI7,
          "triad_reduction_percent_computed_from_reported_abundances":100*(1-STOCK_ALTERBBN_TRIAD_LI7/stock),
          "historical_target_from_stock_using_assigned_xi_1_231":stock*math.exp(-1.231),
          "single_A_B_C_sum_percent":sum([RATE_PERTURBATIONS_PERCENT["R17 +20%"],RATE_PERTURBATIONS_PERCENT["R27 -20%"],RATE_PERTURBATIONS_PERCENT["R34 +20%"]]),
          "ABC_minus_sum_percentage_points":RATE_PERTURBATIONS_PERCENT["R17/R27/R34"]-sum([RATE_PERTURBATIONS_PERCENT["R17 +20%"],RATE_PERTURBATIONS_PERCENT["R27 -20%"],RATE_PERTURBATIONS_PERCENT["R34 +20%"]])
      },
      "conclusions":[
        "Fitting exp(-Xi) to lithium target is numerical arithmetic, not a physical explanation.",
        "The historical q and Xi are inconsistent with the stated sqrt(E) Gaussian integral over 0..1.",
        "The May q*E*chi draft without window disagrees more strongly with Xi=1.23.",
        "The Sept 8 actual AlterBBN successor's best preregistered triad reduces mass-7 ~29.7%, not 70.8%.",
        "No full network integration of the original proposed DT operator demonstrated.",
        "Window has no mapped BBN cosmic time/temperature; channel Xi values were hand-assigned."
      ]
    }
    return out

def write_artifacts(root:Path,make_figures=True):
    run=reconstruct()
    runs=root/"runs"/"bbn";runs.mkdir(parents=True,exist_ok=True)
    fig=root/"visuals"/"bbn";fig.mkdir(parents=True,exist_ok=True)
    path=runs/"source_reconciliation_2026-10-18.json"
    path.write_text(json.dumps(run,indent=2,sort_keys=True)+"\n",encoding="utf-8")
    with (runs/"channel_survival.csv").open("w",encoding="utf-8",newline="") as f:
        writer=csv.DictWriter(f,fieldnames=["channel","xi_assigned","remaining_fraction","loss_fraction"])
        writer.writeheader();writer.writerows(run["source_assigned_channel_survival"])
    if make_figures:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
        fig1,ax=plt.subplots(figsize=(11,6))
        labels=["Stock AlterBBN\n(Sept 8 run)","Triad A+B+C\n(actual successor)","Historical target\n(assigned Xi=1.23)","Stock × exp(-1.231)\n(not physical run)"]
        values=[STOCK_ALTERBBN["Li7_H"],STOCK_ALTERBBN_TRIAD_LI7,run["original_surrogate"]["target_li7_h"],run["observed_in_source_rate_trials"]["historical_target_from_stock_using_assigned_xi_1_231"]]
        bars=ax.bar(range(4),[v/1e-10 for v in values])
        ax.set_xticks(range(4),labels)
        ax.set_ylabel("Li-7 / H   × 10⁻¹⁰")
        ax.set_title("BBN lithium: executed successor vs historical fitted target")
        for b,v in zip(bars,values):ax.text(b.get_x()+b.get_width()/2,b.get_height()+.1,f"{v:.4e}",ha="center",fontsize=9)
        ax.set_ylim(0,6.6);fig1.tight_layout()
        fig1.savefig(fig/"li7_stock_successor_target.png",dpi=160)
        fig1.savefig(fig/"li7_stock_successor_target.svg")
        plt.close(fig1)
        fig2,ax=plt.subplots(figsize=(9,5))
        ts=[i/500 for i in range(501)];ax.plot(ts,[gaussian(t) for t in ts],label="Assigned Gaussian window")
        ax.axvline(WINDOW_CENTER,linestyle="--",label="Normalized center 0.5")
        ax.set_xlabel("Normalized time (NOT mapped to cosmic time)")
        ax.set_ylabel("Window weight")
        ax.set_title(f"Historical proposal's Gaussian window: integral = {window_integral():.9f}")
        ax.legend();fig2.tight_layout()
        fig2.savefig(fig/"window_normalized.png",dpi=160)
        fig2.savefig(fig/"window_normalized.svg");plt.close(fig2)
        fig3,ax=plt.subplots(figsize=(10,5))
        names=list(RATE_PERTURBATIONS_PERCENT);val=list(RATE_PERTURBATIONS_PERCENT.values())
        ax.barh(names,val);ax.axvline(0)
        ax.set_xlabel("Reported Li-7/H change from stock (%)")
        ax.set_title("AlterBBN successor rate probes: preregistered combinations")
        ax.invert_yaxis();fig3.tight_layout()
        fig3.savefig(fig/"rate_probe_changes.png",dpi=160)
        fig3.savefig(fig/"rate_probe_changes.svg");plt.close(fig3)
        fig4,ax=plt.subplots(figsize=(9,5))
        names=list(SURVIVAL_ASSIGNED_XI);vals=[math.exp(-x) for x in SURVIVAL_ASSIGNED_XI.values()]
        ax.bar(names,vals);ax.set_ylim(0,1.1);ax.set_ylabel("Fraction remaining, e^-Xi (assigned model)")
        ax.set_title("Historical channel filter: assigned, NOT nuclear-network-derived")
        fig4.tight_layout();fig4.savefig(fig/"assigned_channel_survival.png",dpi=160)
        fig4.savefig(fig/"assigned_channel_survival.svg");plt.close(fig4)
    print(json.dumps({"status":"BBN_ARITHMETIC_RECONSTRUCTION_DONE","window_integral":run["operator_consistency"]["integral_0_to_1"],"xi_implied":run["operator_consistency"]["xi_implied_by_q_sqrtE_chi_window"],"q_required":run["operator_consistency"]["q_required_for_target_xi"],"triad_li7":STOCK_ALTERBBN_TRIAD_LI7,"sha256":hashlib.sha256(path.read_bytes()).hexdigest(),"files":[p.name for p in fig.glob("*")]},indent=2))

if __name__=="__main__":
    no_plots="--no-plots" in sys.argv
    write_artifacts(Path(__file__).resolve().parents[1],not no_plots)
