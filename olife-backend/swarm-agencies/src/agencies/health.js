'use strict';

module.exports = {
  describe() {
    return {
      mission: 'M5 — Wellbeing',
      capabilities: ['biometric_analysis', 'supplement_stack', 'sleep_optimization', 'longevity_protocol', 'workout_plan'],
    };
  },

  async run(payload, ctx) {
    const { task, data = {} } = payload;

    switch (task) {
      case 'biometric_analysis': {
        const { metrics = {} } = data;
        const prompt = [
          { role: 'system', content: 'You are O LIFE M5 Health Intelligence. Analyze biometrics with clinical precision. Note: you provide wellness information, not medical advice.' },
          { role: 'user', content: `Biometrics:\n${JSON.stringify(metrics, null, 2)}\n\nProvide: 1) health score (0-100), 2) top 3 areas to optimize, 3) 30-day protocol, 4) key risks to monitor` },
        ];
        const analysis = await ctx.ai(prompt, { max_tokens: 1500 });
        return { metrics, analysis };
      }

      case 'supplement_stack': {
        const { age, sex, goals = [], existing_conditions = [], budget_monthly = 100 } = data;
        const prompt = [
          { role: 'system', content: 'You are a precision nutrition AI. Create evidence-based supplement protocols. Always note this is not medical advice.' },
          { role: 'user', content: `Age: ${age}, Sex: ${sex}\nGoals: ${goals.join(', ')}\nConditions: ${existing_conditions.join(', ')}\nBudget: $${budget_monthly}/mo\n\nCreate an optimized supplement stack with dosages, timing, and rationale. Include cost breakdown.` },
        ];
        const stack = await ctx.ai(prompt, { max_tokens: 2000 });
        return { stack, disclaimer: 'Consult a healthcare professional before starting any supplement regimen.' };
      }

      case 'sleep_optimization': {
        const { sleep_data = {}, chronotype, goals = [] } = data;
        const prompt = [
          { role: 'system', content: 'You are a sleep science AI. Optimize sleep architecture for performance and longevity.' },
          { role: 'user', content: `Sleep data: ${JSON.stringify(sleep_data)}\nChronotype: ${chronotype}\nGoals: ${goals.join(', ')}\n\nCreate a 30-day sleep optimization protocol with specific interventions for each sleep stage.` },
        ];
        const protocol = await ctx.ai(prompt, { max_tokens: 1800 });
        return { protocol };
      }

      case 'longevity_protocol': {
        const { age, lifestyle_data = {} } = data;
        const prompt = [
          { role: 'system', content: 'You are a longevity optimization AI drawing from Bryan Johnson Blueprint, Peter Attia, and current longevity research.' },
          { role: 'user', content: `Age: ${age}\nLifestyle: ${JSON.stringify(lifestyle_data)}\n\nCreate a personalized longevity protocol covering: diet, exercise, sleep, stress, biomarkers to track, and annual testing.` },
        ];
        const protocol = await ctx.ai(prompt, { max_tokens: 2500 });
        return { age, protocol };
      }

      case 'workout_plan': {
        const { fitness_level, goals = [], equipment = [], time_available_weekly_hours = 5 } = data;
        const prompt = [
          { role: 'system', content: 'You are an elite strength & conditioning AI. Design evidence-based, periodized training programs.' },
          { role: 'user', content: `Level: ${fitness_level}\nGoals: ${goals.join(', ')}\nEquipment: ${equipment.join(', ')}\nTime: ${time_available_weekly_hours}h/week\n\nCreate a 12-week periodized program with weekly structure, progressive overload, and deload weeks.` },
        ];
        const plan = await ctx.ai(prompt, { max_tokens: 2500 });
        return { plan };
      }

      default:
        return { error: `Unknown task: ${task}`, available_tasks: ['biometric_analysis', 'supplement_stack', 'sleep_optimization', 'longevity_protocol', 'workout_plan'] };
    }
  },
};
