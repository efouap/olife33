'use strict';

module.exports = {
  describe() {
    return {
      mission: 'M6 — Truth & Foresight',
      capabilities: ['decision_tree', 'scenario_simulation', 'probability_analysis', 'risk_matrix', 'second_order_effects'],
    };
  },

  async run(payload, ctx) {
    const { task, data = {} } = payload;

    switch (task) {
      case 'decision_tree': {
        const { decision, options = [], context = '', time_horizon = '1 year' } = data;
        const prompt = [
          { role: 'system', content: 'You are O LIFE M6 Quantum Intelligence. Model decision trees with probabilistic outcomes. Think in second and third-order consequences.' },
          { role: 'user', content: `Decision: "${decision}"\nOptions: ${options.join(', ')}\nContext: ${context}\nTime horizon: ${time_horizon}\n\nFor each option, provide: probability of success (0-100%), expected value, 3 best-case outcomes, 3 worst-case outcomes, hidden risks, and reversibility score.` },
        ];
        const tree = await ctx.ai(prompt, { max_tokens: 2500 });
        return { decision, options, tree };
      }

      case 'scenario_simulation': {
        const { base_situation, variables = [], num_scenarios = 5 } = data;
        const prompt = [
          { role: 'system', content: 'You are a scenario planning AI. Simulate futures with precision.' },
          { role: 'user', content: `Base situation: ${base_situation}\nKey variables: ${variables.join(', ')}\n\nSimulate ${num_scenarios} distinct scenarios ranging from worst to best case. Include probability estimates and key trigger events for each.` },
        ];
        const scenarios = await ctx.ai(prompt, { max_tokens: 2500 });
        return { scenarios };
      }

      case 'probability_analysis': {
        const { question, evidence = [], base_rate = null } = data;
        const prompt = [
          { role: 'system', content: 'You are a Bayesian reasoning AI. Apply probabilistic thinking rigorously.' },
          { role: 'user', content: `Question: "${question}"\nBase rate: ${base_rate || 'unknown'}\nEvidence: ${evidence.join('; ')}\n\nApply Bayesian updating. Show: prior probability, evidence weights, posterior probability, confidence interval, and what would change your estimate.` },
        ];
        const analysis = await ctx.ai(prompt, { max_tokens: 1500 });
        return { question, analysis };
      }

      case 'risk_matrix': {
        const { project_or_decision, risks = [] } = data;
        const prompt = [
          { role: 'system', content: 'You are a risk intelligence AI. Build comprehensive risk matrices with mitigation strategies.' },
          { role: 'user', content: `Project/Decision: ${project_or_decision}\nKnown risks: ${risks.join(', ')}\n\nCreate a full risk matrix with: probability (1-5), impact (1-5), risk score, category (strategic/operational/financial/reputational), mitigation strategy, and contingency plan.` },
        ];
        const matrix = await ctx.ai(prompt, { max_tokens: 2000 });
        return { matrix };
      }

      case 'second_order_effects': {
        const { action, domain = 'general' } = data;
        const prompt = [
          { role: 'system', content: 'You think in systems. Map 1st, 2nd, and 3rd-order effects of actions across domains.' },
          { role: 'user', content: `Action: "${action}"\nDomain: ${domain}\n\nMap the effect cascade: immediate effects → second-order effects → third-order effects → long-term equilibrium. Include unintended consequences and feedback loops.` },
        ];
        const effects = await ctx.ai(prompt, { max_tokens: 2000 });
        return { action, effects };
      }

      default:
        return { error: `Unknown task: ${task}`, available_tasks: ['decision_tree', 'scenario_simulation', 'probability_analysis', 'risk_matrix', 'second_order_effects'] };
    }
  },
};
