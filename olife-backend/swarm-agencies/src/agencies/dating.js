'use strict';

module.exports = {
  describe() {
    return {
      mission: 'M4 — Connection',
      capabilities: ['profile_audit', 'opener_generation', 'conversation_coach', 'date_planning', 'attraction_analysis'],
    };
  },

  async run(payload, ctx) {
    const { task, data = {} } = payload;

    switch (task) {
      case 'profile_audit': {
        const { bio = '', photos_description = '', platform = 'Hinge', target_demographic = '' } = data;
        const prompt = [
          { role: 'system', content: 'You are O LIFE M4 Connection Intelligence. You optimize dating profiles for maximum genuine connection. Be specific, actionable, and honest.' },
          { role: 'user', content: `Platform: ${platform}\nTarget: ${target_demographic}\nBio: "${bio}"\nPhotos: ${photos_description}\n\nProvide: 1) profile score (0-100), 2) top 3 weaknesses, 3) rewritten bio, 4) photo order recommendation, 5) 3 specific prompts to add` },
        ];
        const audit = await ctx.ai(prompt, { max_tokens: 2000 });
        return { platform, audit };
      }

      case 'opener_generation': {
        const { match_profile = '', num_openers = 5, style = 'playful' } = data;
        const prompt = [
          { role: 'system', content: 'You are a connection expert. Generate openers that spark genuine conversation. No clichés.' },
          { role: 'user', content: `Match profile: "${match_profile}"\nStyle: ${style}\n\nGenerate ${num_openers} unique openers. Each should reference something specific from their profile. Format: numbered list.` },
        ];
        const openers = await ctx.ai(prompt, { max_tokens: 800 });
        return { openers, style };
      }

      case 'conversation_coach': {
        const { conversation_history = [], goal = 'get a date', stuck_point = '' } = data;
        const prompt = [
          { role: 'system', content: 'You are a social dynamics expert. Help navigate conversations to create genuine connection.' },
          { role: 'user', content: `Goal: ${goal}\nStuck point: ${stuck_point}\nConversation:\n${conversation_history.map((m) => `${m.role}: ${m.content}`).join('\n')}\n\nProvide: 1) analysis of conversation dynamics, 2) 3 possible next messages, 3) what to avoid` },
        ];
        const coaching = await ctx.ai(prompt, { max_tokens: 1200 });
        return { coaching };
      }

      case 'date_planning': {
        const { city, interests = [], budget = 'moderate', vibe = 'romantic' } = data;
        const prompt = [
          { role: 'system', content: 'You are a date experience architect. Create memorable experiences.' },
          { role: 'user', content: `City: ${city}\nShared interests: ${interests.join(', ')}\nBudget: ${budget}\nVibe: ${vibe}\n\nDesign 3 unique date experiences with: venue, timing, conversation starters, and backup plans.` },
        ];
        const plan = await ctx.ai(prompt, { max_tokens: 1500 });
        return { city, plan };
      }

      case 'attraction_analysis': {
        const { interaction_description = '' } = data;
        const prompt = [
          { role: 'system', content: 'You analyze social dynamics to identify genuine connection signals vs. disinterest.' },
          { role: 'user', content: `Interaction: "${interaction_description}"\n\nAnalyze: 1) interest level indicators, 2) potential concerns, 3) recommended next steps` },
        ];
        const analysis = await ctx.ai(prompt, { max_tokens: 800 });
        return { analysis };
      }

      default:
        return { error: `Unknown task: ${task}`, available_tasks: ['profile_audit', 'opener_generation', 'conversation_coach', 'date_planning', 'attraction_analysis'] };
    }
  },
};
