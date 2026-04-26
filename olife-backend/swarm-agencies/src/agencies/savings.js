'use strict';

module.exports = {
  describe() {
    return {
      mission: 'M1 — Wealth Creation',
      capabilities: ['subscription_scan', 'bill_negotiation', 'savings_analysis', 'budget_forecast'],
    };
  },

  async run(payload, ctx) {
    const { task, data = {} } = payload;

    switch (task) {
      case 'subscription_scan': {
        const { transactions = [], monthly_income = 0 } = data;

        // Find recurring charges
        const recurring = detectRecurring(transactions);

        const prompt = [
          { role: 'system', content: 'You are O LIFE M1 Wealth Agent. Identify wasteful subscriptions and calculate precise savings. Be specific with dollar amounts.' },
          { role: 'user', content: `Monthly income: $${monthly_income}\nRecurring charges detected:\n${JSON.stringify(recurring, null, 2)}\n\nList subscriptions to cancel with monthly savings. Format as JSON array: [{name, amount, reason, savings_per_year}]` },
        ];

        const aiResult = await ctx.ai(prompt, { provider: 'groq', max_tokens: 1500 });

        let recommendations = [];
        try {
          const match = aiResult.match(/\[[\s\S]*\]/);
          if (match) recommendations = JSON.parse(match[0]);
        } catch (_) {}

        const totalSavings = recommendations.reduce((s, r) => s + (r.savings_per_year || 0), 0);

        await ctx.emit('subscription_scan_complete', { recurring: recurring.length, recommendations: recommendations.length, totalSavings });

        return {
          recurring_count: recurring.length,
          recurring,
          recommendations,
          total_annual_savings: totalSavings,
          ai_analysis: aiResult,
        };
      }

      case 'bill_negotiation': {
        const { bill_type, current_amount, provider, tenure_months = 0 } = data;

        const prompt = [
          { role: 'system', content: 'You are a bill negotiation expert. Provide exact scripts and strategies.' },
          { role: 'user', content: `Bill: ${bill_type} with ${provider}\nCurrent monthly: $${current_amount}\nCustomer tenure: ${tenure_months} months\n\nProvide: 1) negotiation script, 2) competitor rates to cite, 3) retention offers to ask for, 4) estimated savings range` },
        ];

        const script = await ctx.ai(prompt, { max_tokens: 1200 });
        return { bill_type, provider, current_amount, negotiation_script: script };
      }

      case 'savings_analysis': {
        const { income, expenses = {}, goals = [] } = data;

        const prompt = [
          { role: 'system', content: 'You are O LIFE M1. Analyze finances and create a concrete savings plan with timeline.' },
          { role: 'user', content: `Income: $${income}/mo\nExpenses: ${JSON.stringify(expenses)}\nGoals: ${goals.join(', ')}\n\nCreate a 90-day savings acceleration plan with weekly milestones.` },
        ];

        const plan = await ctx.ai(prompt, { max_tokens: 2000 });
        return { income, plan, goals };
      }

      case 'budget_forecast': {
        const { historical_data = [], months_ahead = 3 } = data;
        const prompt = [
          { role: 'system', content: 'You are a financial forecasting AI. Provide precise projections.' },
          { role: 'user', content: `Historical spending data: ${JSON.stringify(historical_data)}\nForecast ${months_ahead} months ahead. Include category breakdowns and seasonal adjustments.` },
        ];
        const forecast = await ctx.ai(prompt, { max_tokens: 1500 });
        return { months_ahead, forecast };
      }

      default:
        return { error: `Unknown task: ${task}`, available_tasks: ['subscription_scan', 'bill_negotiation', 'savings_analysis', 'budget_forecast'] };
    }
  },
};

function detectRecurring(transactions) {
  const byMerchant = {};
  transactions.forEach((t) => {
    const key = (t.merchant || t.description || '').toLowerCase().trim();
    if (!key) return;
    if (!byMerchant[key]) byMerchant[key] = [];
    byMerchant[key].push(t);
  });
  return Object.entries(byMerchant)
    .filter(([, txns]) => txns.length >= 2)
    .map(([merchant, txns]) => ({
      merchant,
      occurrences: txns.length,
      avg_amount: txns.reduce((s, t) => s + Math.abs(t.amount || 0), 0) / txns.length,
      total_paid: txns.reduce((s, t) => s + Math.abs(t.amount || 0), 0),
    }))
    .sort((a, b) => b.total_paid - a.total_paid);
}
