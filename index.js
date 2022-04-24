const { Plugin } = require('powercord/entities');
const { React, getModule } = require('powercord/webpack');
const { inject, uninject } = require('powercord/injector');
const { AsyncComponent } = require('powercord/components');

const Popout = AsyncComponent.fromDisplayName('Popout');
const UserPopoutContainer = AsyncComponent.from(getModule(m => m.type?.displayName === 'UserPopoutContainer'));


module.exports = class ClickableMentions extends Plugin {
    startPlugin () {
        this.classes = {
        ...getModule([ 'cursorDefault', 'cursorPointer' ], false)
        } || {};

        this.patchRichMentions();
    }

    patchRichMentions () {
        const DiscordRichComponents = getModule([ 'RoleMention', 'UserMention' ], false);
        console.log(DiscordRichComponents)

        inject('clickable-umentions-slate', DiscordRichComponents, 'UserMention', (args, res) => {
            const [ props ] = args;
            const { children } = res?.props || {};

            if (!children) return res;

            if (typeof children === 'function') {
                const tooltipChildren = children;

                res.props.children = (tooltipProps) => this.renderUserPopout(props, tooltipChildren(tooltipProps));
            } else {
                res = this.renderUserPopout(props, children);
            }

            return res;
        });
    }

    renderUserPopout (props, children) {
        if (!children.props) return children;

        children.props.className = [ children.props.className, this.classes.cursorPointer ].filter(Boolean).join(' ');

        const { openUserContextMenu } = getModule(['openUserContextMenu'], false);
        const userStore = getModule([ 'initialize', 'getCurrentUser' ], false);
        const { getChannel } = getModule([ 'initialize', 'hasChannel' ], false);

        return React.createElement(Popout, {
            renderPopout: (popoutProps) => React.createElement(UserPopoutContainer, {
                ...popoutProps,
                userId: props.id ?? null,
                channelId: props.channelId ?? null,
                guildId: props.guildId ?? null
            }),
            position: 'top'
        }, (popoutProps) => {
            children.props = Object.assign({}, children.props, popoutProps, {onContextMenu: (e) => {
                openUserContextMenu(e, userStore.getUser(props.id ?? null), getChannel(props.channelId ?? null));
            }});

            return children;
        });
    }

    pluginWillUnload () {
        uninject('clickable-umentions-slate');
        uninject('clickable-cmentions-slate');
    }
};