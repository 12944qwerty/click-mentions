/* eslint-disable new-cap */
const { Plugin } = require('powercord/entities');
const { React, getModule, constants: { Routes, ActionTypes }, FluxDispatcher, getModuleByDisplayName } = require('powercord/webpack');
const { inject, uninject } = require('powercord/injector');
const { AsyncComponent } = require('powercord/components');
const { wrapInHooks } = require('powercord/util');

const Popout = AsyncComponent.fromDisplayName('Popout');
const UserPopoutContainer = AsyncComponent.from(getModule(m => m.type?.displayName === 'UserPopoutContainer'));

const { transitionTo } = getModule([ 'transitionTo' ], false);
const channelStore = getModule([ 'getDMFromUserId', 'getChannel' ], false);
const { openUserContextMenu } = getModule([ 'openUserContextMenu' ], false);
const userStore = getModule([ 'initialize', 'getCurrentUser' ], false);
const { getChannel } = getModule([ 'initialize', 'hasChannel' ], false);

module.exports = class ClickableMentions extends Plugin {
  startPlugin () {
    this.classes = {
      ...getModule([ 'cursorDefault', 'cursorPointer' ], false)
    } || {};

    this.patchRichMentions();
  }

  patchRichMentions () {
    const DiscordRichComponents = getModule([ 'RoleMention', 'UserMention' ], false);
    console.log(DiscordRichComponents); // Used to see what else we can patch :P

    inject('clickable-umentions-slate', DiscordRichComponents, 'UserMention', (args, res) => {
      const [ props ] = args;
      const { children } = res?.props || {};

      if (!children) {
        return res;
      }

      if (typeof children === 'function') {
        const tooltipChildren = children;

        res.props.children = (tooltipProps) => this.renderUserPopout(props, tooltipChildren(tooltipProps));
      } else {
        res = this.renderUserPopout(props, children);
      }

      return res;
    });

    inject('clickable-cmentions-slate', DiscordRichComponents, 'ChannelMention', ([ { id: channelId } ], res) => {
      const { children } = res?.props || {};

      if (!children) {
        return res;
      }

      res = React.createElement('div', {
        onClick: () => {
          let guildId, messageId;

          FluxDispatcher.dirtyDispatch({ type: ActionTypes.LAYER_POP });

          if (channelId) {
            const channel = channelStore.getChannel(channelId);
            if (!channel) {
              return;
            }

            guildId = channel.guild_id;
            messageId = channel.lastMessageId;
          }

          transitionTo(Routes.CHANNEL(guildId, channelId, messageId));
        },
        onContextMenu: (event) => {
          const channel = channelStore.getChannel(channelId);
          if (!channel) {
            return;
          }

          let ConnectedChannel;

          if (channel.isVocal()) {
            ConnectedChannel = getModuleByDisplayName('ConnectedVoiceChannel', false);
          } else {
            ConnectedChannel = getModuleByDisplayName('ConnectedTextChannel', false);
          }

          return (
            wrapInHooks(() => new ConnectedChannel({ channel,
              guild: {} }))()
          ).type.DecoratedComponent({ channel }).prototype.constructor.handleContextMenu(event);
        }
      }, res);

      return res;
    });
  }

  renderUserPopout (props, children) {
    if (!children.props) {
      return children;
    }

    children.props.className = [ children.props.className, this.classes.cursorPointer ].filter(Boolean).join(' ');

    return React.createElement(Popout, {
      renderPopout: (popoutProps) => React.createElement(UserPopoutContainer, {
        ...popoutProps,
        userId: props.id ?? null,
        channelId: props.channelId ?? null,
        guildId: props.guildId ?? null
      }),
      position: 'top'
    }, (popoutProps) => {
      children.props = Object.assign({}, children.props, popoutProps, { onContextMenu: (e) => {
        openUserContextMenu(e, userStore.getUser(props.id ?? null), getChannel(props.channelId ?? null));
      } });

      return children;
    });
  }

  pluginWillUnload () {
    uninject('clickable-umentions-slate');
    uninject('clickable-cmentions-slate');
  }
};
