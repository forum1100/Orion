const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');

const AREAS=Object.freeze(['FAMILY_TRUST','LLC_HOLDING_COMPANY','IP_OWNERSHIP','TAX_COORDINATION','BANK_CHARTER','CREDIT_UNION_CHARTER','PAYMENTS','REVENUE','SECURITIES','LENDING']);
const HARD_GATES=Object.freeze({
  BANK_CHARTER:['charter authority','capital requirements','management/governance','BSA/AML','deposit insurance or equivalent','operational examination readiness'],
  CREDIT_UNION_CHARTER:['field of membership','charter authority','organizers/governance','business plan','capital/financial projections','share insurance or equivalent'],
  SECURITIES:['offering classification','registration or exemption','disclosure','investor eligibility where applicable','broker/dealer or finder analysis'],
  LENDING:['lender licensing analysis','usury/rate limits','consumer/commercial classification','disclosures','servicing/collections compliance']
});
const DEFAULT_PROFILE=Object.freeze({country:'US',state:'FL',county:'Volusia'});
function atomic(file,value){fs.mkdirSync(path.dirname(file),{recursive:true});const t=file+'.tmp';fs.writeFileSync(t,JSON.stringify(value,null,2),'utf8');fs.renameSync(t,file);}

class EnterpriseFamilyCapital {
  constructor({root,vault=null,experience=null,runAICouncil=null}={}){
    this.root=path.join(root,'enterprise-family-capital');this.file=path.join(this.root,'state.json');
    this.vault=vault;this.experience=experience;this.runAICouncil=runAICouncil;fs.mkdirSync(this.root,{recursive:true});
  }
  load(){try{return JSON.parse(fs.readFileSync(this.file,'utf8'));}catch{return {schema:'dt-enterprise-family-capital/1.0',profile:DEFAULT_PROFILE,
    architecture:{},revenuePlan:{},regulatedProjects:{},training:{completed:[]},updatedAt:null};}}
  status(){return this.load();}
  trainingPlan(){return {profile:DEFAULT_PROFILE,areas:AREAS,tasks:[
    'Map family trust, individual ownership, LLC, future holding-company, and IP-control options with explicit control/succession/tax questions.',
    'Build entity-formation checklists, governance records, beneficial-owner/compliance records, banking/payment onboarding, and annual maintenance calendars.',
    'Build revenue-launch workflow for DT/Distel products: offer definition, pricing, invoicing/payment rails, fulfillment, refund/support, bookkeeping, tax capture, and audit trail.',
    'Build federal/state credit-union feasibility workflow including field of membership, chartering, governance, business plan, projections, insurance, and examination readiness.',
    'Build bank-charter feasibility workflow including charter authority, capital, management, BSA/AML, deposit insurance, technology/vendor controls, and examination readiness.',
    'Build hard separation between customer revenue and regulated deposits, investments, custody, securities offerings, and lending.',
    'Build source-verification checklists so current regulator/statute/rule requirements are refreshed before any regulated activation.'
  ],hardGates:HARD_GATES};}
  classifyMoneyFlow(input={}){
    const kind=String(input.kind||input.description||'').toLowerCase();
    if(/deposit|checking|savings|member share/.test(kind))return {class:'REGULATED_DEPOSIT',execution:'BLOCK_UNTIL_CHARTER_AND_INSURANCE_VERIFIED'};
    if(/invest|equity|share sale|security|note offering|fundraise/.test(kind))return {class:'SECURITIES_OR_CAPITAL_RAISE',execution:'BLOCK_UNTIL_OFFERING_COMPLIANCE_VERIFIED'};
    if(/loan|lend|interest|credit/.test(kind))return {class:'LENDING',execution:'BLOCK_UNTIL_LENDING_COMPLIANCE_VERIFIED'};
    return {class:'ORDINARY_BUSINESS_REVENUE',execution:'ELIGIBLE_FOR_AUTOMATION_AFTER_ENTITY_PAYMENT_TAX_SETUP'};
  }
  revenueBlueprint(input={}){
    return {schema:'dt-revenue-launch/1.0',goal:input.goal||'Begin collecting lawful customer revenue from DT/Distel products',steps:[
      {id:'offer',action:'Define product/service, buyer, deliverable, scope, price, refund/support terms'},
      {id:'entity',action:'Confirm selling entity, ownership/IP license, tax identity, business address/contact records'},
      {id:'payments',action:'Connect compliant merchant/payment processor and settlement account; do not hold customer deposits as a bank'},
      {id:'checkout',action:'Create invoice/checkout/contract acceptance with receipt and terms'},
      {id:'fulfillment',action:'Automate delivery/access provisioning and support workflow'},
      {id:'ledger',action:'Record gross revenue, fees, refunds, taxes, customer/order IDs, and provenance'},
      {id:'tax',action:'Determine sales-tax/income-tax/bookkeeping requirements by product and customer jurisdiction'},
      {id:'launch',action:'Run test transaction, reconcile receipt-to-bank settlement, then enable production sales'}
    ],regulatedExclusions:['bank deposits','unlicensed lending','securities solicitation','custody of customer investment funds'],status:'READY_FOR_SOURCE_AND_ACCOUNT_CONFIGURATION'};
  }
  async trainingCycle(input={}){
    const state=this.load();const plan=this.trainingPlan();
    const question=String(input.question||plan.tasks[(state.training.completed||[]).length%plan.tasks.length]);
    const peer=typeof this.runAICouncil==='function'?await this.runAICouncil({advisoryOnly:true,task:[
      'ENTERPRISE/FAMILY CAPITAL TRAINING FOR ORION.',
      'Jurisdiction: '+JSON.stringify(state.profile||DEFAULT_PROFILE),
      'Question: '+question,
      'Separate ordinary revenue from regulated deposits, securities, lending, custody, tax, and fiduciary activity.',
      'For trusts/LLCs identify governing documents, control, succession, tax/compliance questions, and source-verification needs.',
      'For bank/credit-union formation identify current regulator/charter/insurance/capital/governance requirements to verify. Do not invent requirements.',
      'Return an executable implementation/training checklist for Orion.'
    ].join('\n')},{ownerApproved:false}):{available:false};
    const row={id:crypto.randomUUID(),question,peer,completedAt:new Date().toISOString()};
    state.training.completed=[...(state.training.completed||[]),row].slice(-500);state.updatedAt=row.completedAt;atomic(this.file,state);
    this.vault?.append('enterprise-training-cycle','orion-enterprise',row);this.experience?.append('enterprise-training-cycle',row,{sourceClass:'DERIVED_ENTERPRISE_TRAINING'});return row;
  }
}
module.exports={EnterpriseFamilyCapital,AREAS,HARD_GATES,DEFAULT_PROFILE};
