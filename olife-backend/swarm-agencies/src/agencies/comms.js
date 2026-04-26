'use strict';

module.exports = {
  describe() {
    return {
      mission: 'M2 — Efficiency & Learning',
      capabilities: ['learning_path', 'skill_synthesis', 'explain_concept', 'knowledge_audit', 'accelerated_curriculum'],
    };
  },

  async run(payload, ctx) {
    const { task, data = {} } = payload;

    switch (task) {
      case 'learning_path': {
        const { topic, current_level = 'beginner', goal, time_available_weekly_hours = 5, learning_style = 'mixed' } = data;
        const prompt = [
          { role: 'system', content: 'You are O LIFE Learning Intelligence. Design accelerated, evidence-based learning paths using spaced repetition, interleaving, and retrieval practice.' },
          { role: 'user', content: `Topic: ${topic}\nLevel: ${current_level}\nGoal: ${goal}\nTime: ${time_available_weekly_hours}h/week\nLearning style: ${learning_style}\n\nCreate a 12-week learning roadmap with: weekly milestones, best resources (free + paid), projects to build, assessments, and estimated time to competency.` },
        ];
        const path = await ctx.ai(prompt, { max_tokens: 2500 });
        return { topic, path };
      }

      case 'skill_synthesis': {
        const { skills = [], domain = '' } = data;
        const prompt = [
          { role: 'system', content: 'You are a skill synthesis AI. Find non-obvious intersections between skills that create unique advantages.' },
          { role: 'user', content: `Skills: ${skills.join(', ')}\nDomain: ${domain}\n\nIdentify: 1) unique skill combinations and their market value, 2) gaps to fill for maximum leverage, 3) emerging opportunities at these intersections, 4) "superpower" combinations that are rare` },
        ];
        const synthesis = await ctx.ai(prompt, { max_tokens: 1800 });
        return { skills, synthesis };
      }

      case 'explain_concept': {
        const { concept, depth = 'intermediate', analogies = true } = data;
        const prompt = [
          { role: 'system', content: 'You are a master teacher. Explain any concept with crystal clarity using the Feynman technique.' },
          { role: 'user', content: `Concept: "${concept}"\nDepth: ${depth}\n${analogies ? 'Include memorable analogies.' : ''}\n\nExplain: 1) core intuition (5-year-old level), 2) mechanics at ${depth} level, 3) common misconceptions, 4) real-world applications, 5) next concepts to learn` },
        ];
        const explanation = await ctx.ai(prompt, { max_tokens: 2000 });
        return { concept, explanation };
      }

      case 'knowledge_audit': {
        const { domain, self_assessment = {} } = data;
        const prompt = [
          { role: 'system', content: 'You are a knowledge mapping AI. Identify gaps and create remediation plans.' },
          { role: 'user', content: `Domain: ${domain}\nSelf-assessment: ${JSON.stringify(self_assessment)}\n\nCreate: 1) knowledge map (what you know vs. should know), 2) critical gaps (ranked by importance), 3) 30-day remediation plan, 4) resources for each gap` },
        ];
        const audit = await ctx.ai(prompt, { max_tokens: 2000 });
        return { domain, audit };
      }

      case 'accelerated_curriculum': {
        const { subject, deadline_days = 30, prior_knowledge = [] } = data;
        const prompt = [
          { role: 'system', content: 'You design 80/20 crash courses. Find the 20% of knowledge that gives 80% of competency.' },
          { role: 'user', content: `Subject: ${subject}\nDeadline: ${deadline_days} days\nAlready know: ${prior_knowledge.join(', ')}\n\nDesign a day-by-day accelerated curriculum using: core concepts only, active recall, chunking, and daily output goals.` },
        ];
        const curriculum = await ctx.ai(prompt, { max_tokens: 2500 });
        return { subject, deadline_days, curriculum };
      }

      default:
        return { error: `Unknown task: ${task}`, available_tasks: ['learning_path', 'skill_synthesis', 'explain_concept', 'knowledge_audit', 'accelerated_curriculum'] };
    }
  },
};
