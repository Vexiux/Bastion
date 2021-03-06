/**
 * @file acrophobia command
 * @author Sankarsan Kampa (a.k.a k3rn31p4nic)
 * @license GPL-3.0
 */

let activeChannels = {};

exports.exec = async (Bastion, message) => {
  if (activeChannels.hasOwnProperty(message.channel.id))  {
    return Bastion.emit('error', '', Bastion.i18n.error(message.guild.language, 'isGameInUse', 'acrophobia'), message.channel);
  }

  activeChannels[message.channel.id] = {};
  activeChannels[message.channel.id].usersSubmitted = [];
  activeChannels[message.channel.id].usersVoted = [];

  let acroLen = Number.random(3, 6);
  let acronym = [];
  for (let i = 0; i < acroLen; i++) {
    acronym.push(Bastion.methods.getRandomChar(true).toUpperCase());
  }

  let startMessage = await message.channel.send({
    embed: {
      color: Bastion.colors.BLUE,
      title: 'Acrophobia',
      description: `Game started by ${message.author}. Create a sentence with this acronym: **${acronym.join('. ')}.**`,
      footer: {
        text: `You have ${2} minutes to make your submission.`
      }
    }
  });

  const collector = startMessage.channel.createMessageCollector(
    m => !m.author.bot && m.content.split(' ').length === acroLen && matchAcronym(acronym, m.content.split(' ')) && !activeChannels[message.channel.id].usersSubmitted.includes(m.author.id),
    { time: 2 * 60 * 1000 }
  );

  collector.on('collect', async (msg, sentences) => {
    try {
      if (msg.deletable) msg.delete().catch(() => {});

      let submissions = await msg.channel.send({
        embed: {
          description: `${msg.author} made their submission.`,
          footer: {
            text: `${sentences.collected.size} submissions in total.`
          }
        }
      });
      activeChannels[message.channel.id].usersSubmitted.push(msg.author.id);

      submissions.delete(5000).catch(e => {
        Bastion.log.error(e);
      });
    }
    catch (e) {
      Bastion.log.error(e);
    }
  });

  collector.on('end', async (collection) => {
    try {
      if (collection.size === 0) {
        await message.channel.send({
          embed: {
            color: Bastion.colors.RED,
            title: 'Acrophobia',
            description: 'Game ended. Unfortunately, no submissions were made for this acronym.'
          }
        }).catch(e => {
          Bastion.log.error(e);
        });

        delete activeChannels[message.channel.id];
        startMessage.delete().catch(() => {});
      }
      else {
        let submissions = [];
        for (let i = 0; i < collection.size; i++) {
          submissions.push(`**${i + 1}.** ${collection.map(a => a.content)[i]}`);
        }

        let submissionMessage = await startMessage.channel.send({
          embed: {
            color: Bastion.colors.BLUE,
            title: 'Acrophobia',
            description: 'Submissions closed',
            fields: [
              {
                name: `Submitted sentences for ${acronym.join('. ')}.:`,
                value: submissions.join('\n')
              }
            ],
            footer: {
              text: 'Vote by typing the corresponding number of a sentence. You have 60 seconds to vote.'
            }
          }
        }).catch(e => {
          Bastion.log.error(e);
        });

        startMessage.delete().catch(() => {});

        const votesCollector = startMessage.channel.createMessageCollector(
          m => !m.author.bot && parseInt(m.content) > 0 && parseInt(m.content) <= collection.size && !activeChannels[message.channel.id].usersVoted.includes(m.author.id),
          { time: 60 * 1000 }
        );

        votesCollector.on('collect', async (vote, votes) => {
          try {
            if (vote.deletable) {
              vote.delete().catch(e => {
                Bastion.log.error(e);
              });
            }

            let thankingMessage = await vote.channel.send({
              embed: {
                description: `Thank you, ${vote.author}, for voting.`,
                footer: {
                  text: `${votes.collected.size} votes in total.`
                }
              }
            });
            activeChannels[message.channel.id].usersVoted.push(vote.author.id);

            thankingMessage.delete(5000).catch(() => {});
          }
          catch (e) {
            Bastion.log.error(e);
          }
        });

        votesCollector.on('end', votes => {
          if (votes.size === 0) {
            startMessage.channel.send({
              embed: {
                color: Bastion.colors.RED,
                title: 'Acrophobia',
                description: 'Game ended. Unfortunately, no votes were given for any submissions.'
              }
            }).catch(e => {
              Bastion.log.error(e);
            });

            delete activeChannels[message.channel.id];
            submissionMessage.delete().catch(() => {});
          }
          else {
            votes = votes.map(v => v.content);
            for (let i = collection.size; i > 0; i--) {
              votes.unshift(`${i}`);
            }
            let count = {};
            for (let i = 0; i < votes.length; i++) {
              count[votes[i]] = count[votes[i]] ? count[votes[i]] + 1 : 1;
            }
            let winningVoteIndex = Object.keys(count).reduce(function(a, b) {
              return count[a] > count[b] ? a : b;
            });

            startMessage.channel.send({
              embed: {
                color: Bastion.colors.BLUE,
                title: 'Acrophobia',
                description: `Game Ended. ${collection.map(s => s.author)[winningVoteIndex - 1]} won by ${count[winningVoteIndex] - 1} of ${votes.length - collection.size} votes`,
                fields: [
                  {
                    name: 'Winning submission',
                    value: collection.map(s => s.content)[winningVoteIndex - 1]
                  }
                ]
              }
            }).catch(e => {
              Bastion.log.error(e);
            });

            delete activeChannels[message.channel.id];
            submissionMessage.delete().catch(() => {});
          }
        });
      }
    }
    catch (e) {
      Bastion.log.error(e);
    }
  });
};

exports.config = {
  aliases: [ 'acro' ],
  enabled: true
};

exports.help = {
  name: 'acrophobia',
  description: 'Starts an acrophobia game. The user will have to make a sentence from the given acronym within the given time. After the submission is done, users can vote for the best sentence, the sentence to get highest number of votes win.',
  botPermission: '',
  userTextPermission: '',
  userVoicePermission: '',
  usage: 'acrophobia',
  example: []
};

/**
 * Matches the first character of each element of a array of string to a character pool.
 * @function matchAcronym
 * @param {array} charPool The array that contains the character pool.
 * @param {array} strArr The array of the string to match with the character pool.
 * @returns {boolean} If the first character of each element of the array of string matches the character pool.
*/
function matchAcronym(charPool, strArr) {
  for (let i = 0; i < charPool.length; i++) {
    if (charPool[i] !== strArr[i].charAt(0).toUpperCase()) {
      return false;
    }
  }
  return true;
}
