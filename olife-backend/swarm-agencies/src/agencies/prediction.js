'use strict';

module.exports = {
  describe() {
    return {
      mission: 'M6 — Prediction Markets',
      capabilities: ['market_prediction', 'sports_forecast', 'event_probability', 'edge_finder', 'kelly_criterion'],
    };
  },

  async run(payload, ctx) {
    const { task, data = {} } = payload;

    switch (task) {
      case 'market_prediction': {
        const { market, question, resolution_date, current_odds = null } = data;
        const prompt = [
          { role: 'system', content: 'You are O LIFE Prediction Intelligence. Analyze prediction markets with calibrated probabilistic reasoning. Always show your work.' },
          { role: 'user', content: `Market: ${market}\nQuestion: "${question}"\nResolution: ${resolution_date}\nCurrent odds: ${current_odds || 'not provided'}\n\nProvide: 1) your probability estimate (%), 2) reasoning chain, 3) key uncertainty factors, 4) information that would update your estimate most, 5) edge vs. market (if odds given)` },
        ];
        const prediction = await ctx.ai(prompt, { max_tokens: 1500 });
        return { question, prediction, disclaimer: 'Not financial advice. For educational purposes only.' };
      }

      case 'sports_forecast': {
        const { sport, event, team_a, team_b, relevant_stats = {} } = data;
        const prompt = [
          { role: 'system', content: 'You are a sports analytics AI. Apply statistical modeling to predict sporting outcomes.' },
          { role: 'user', content: `Sport: ${sport}\nEvent: ${event}\n${team_a} vs ${team_b}\nStats: ${JSON.stringify(relevant_stats)}\n\nProvide win probability for each team, expected score/outcome, key factors, and confidence level.` },
        ];
        const forecast = await ctx.ai(prompt, { max_tokens: 1200 });
        return { event, team_a, team_b, forecast };
      }

      case 'event_probability': {
        const { event_description, time_frame, evidence = [] } = data;
        const prompt = [
          { role: 'system', content: 'You are a superforecaster AI trained on prediction market data. Apply base rates, reference classes, and evidence weighting.' },
          { role: 'user', content: `Event: "${event_description}"\nTimeframe: ${time_frame}\nEvidence: ${evidence.join('; ')}\n\nApply superforecaster methodology. Show: base rate, evidence adjustments, final probability, confidence interval, comparable historical events.` },
        ];
        const probability = await ctx.ai(prompt, { max_tokens: 1500 });
        return { event_description, probability };
      }

      case 'kelly_criterion': {
        const { win_probability, odds, bankroll, kelly_fraction = 0.25 } = data;
        const decimalOdds = odds;
        const p = win_probability / 100;
        const q = 1 - p;
        const b = decimalOdds - 1;
        const fullKelly = (b * p - q) / b;
        const fractionalKelly = fullKelly * kelly_fraction;
        const betSize = Math.max(0, fractionalKelly * bankroll);
        const expectedValue = p * b * betSize - q * betSize;

        return {
          full_kelly_pct: (fullKelly * 100).toFixed(2),
          fractional_kelly_pct: (fractionalKelly * 100).toFixed(2),
          recommended_bet: betSize.toFixed(2),
          expected_value: expectedValue.toFixed(2),
          edge_pct: ((p * decimalOdds - 1) * 100).toFixed(2),
          note: fractionalKelly <= 0 ? 'Negative edge — do not bet' : `Bet $${betSize.toFixed(2)} (${(kelly_fraction * 100)}% Kelly)`,
        };
      }

      case 'edge_finder': {
        const { market_odds, your_estimate, market_type = 'binary' } = data;
        const impliedProb = market_type === 'binary' ? (100 / market_odds) : (1 / market_odds) * 100;
        const edge = your_estimate - impliedProb;
        const hasEdge = edge > 2; // minimum 2% edge threshold
        return {
          market_implied_probability: impliedProb.toFixed(1),
          your_estimate,
          edge_percentage: edge.toFixed(1),
          has_edge: hasEdge,
          edge_quality: edge > 10 ? 'strong' : edge > 5 ? 'moderate' : edge > 2 ? 'marginal' : 'none',
          recommendation: hasEdge ? 'Consider position' : 'No edge found — avoid',
        };
      }

      default:
        return { error: `Unknown task: ${task}`, available_tasks: ['market_prediction', 'sports_forecast', 'event_probability', 'kelly_criterion', 'edge_finder'] };
    }
  },
};
