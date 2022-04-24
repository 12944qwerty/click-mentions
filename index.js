const { Plugin } = require('powercord/entities');
const { React, getModule, constants: { Routes, ActionTypes }, FluxDispatcher, contextMenu } = require('powercord/webpack');
const { inject, uninject } = require('powercord/injector');
const { AsyncComponent, ContextMenu } = require('powercord/components');

const Popout = AsyncComponent.fromDisplayName('Popout');
const UserPopoutContainer = AsyncComponent.from(getModule(m => m.type?.displayName === 'UserPopoutContainer'));

const { transitionTo } = getModule([ 'transitionTo' ], false);
const channelStore = getModule([ 'getDMFromUserId', 'getChannel' ], false);

module.exports = class ClickableMentions extends Plugin {
    startPlugin () {
        this.classes = {
        ...getModule([ 'cursorDefault', 'cursorPointer' ], false)
        } || {};

        this.patchRichMentions();
    }

    patchRichMentions () {
        const DiscordRichComponents = getModule([ 'RoleMention', 'UserMention' ], false);
        console.log(DiscordRichComponents) // Used to see what else we can patch :P

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

        inject('clickable-cmentions-slate', DiscordRichComponents, 'ChannelMention', ([{ id: channelId }], res) => {
            const { children } = res?.props || {};

            if (!children) return res;

            res = React.createElement("div", {
                onClick: () => {
                    let guildId, messageId;

                    FluxDispatcher.dirtyDispatch({ type: ActionTypes.LAYER_POP });
                
                    if (channelId) {
                    const channel = channelStore.getChannel(channelId);
                    guildId = channel.guild_id;
                    messageId = channel.lastMessageId;
                    }
                
                    transitionTo(Routes.CHANNEL(guildId, channelId, messageId));
                },
                onContextMenu: (e) => {
                    try {
                        let menu = React.createElement(ContextMenu, {
                            itemGroups: [
                                [{
                                    type: 'button',
                                    name: 'Mark as Read',
                                    onClick: () => {console.log("mark as read")}
                                }],
                                [{
                                    type: 'submenu',
                                    name: 'Mute Channel',
                                    getItems: () => {return [
                                        {
                                            type: 'button',
                                            name: 'For 15 Minutes',
                                            onClick: () => {console.log("mute 15 minutes")}
                                        }
                                    ]}
                                }]
                            ]
                        });
                        contextMenu.openContextMenu(e, () => menu) // temporary context menu
                    } catch (err) {console.log(err)}
                },
            }, res)

            return res;
        })
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