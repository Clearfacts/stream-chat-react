import React, { PureComponent } from 'react';
import { Avatar } from './Avatar';
import PropTypes from 'prop-types';
import { injectIntl } from 'react-intl';

/**
 * Used as preview component for channel item in [ChannelList](#channellist) component.
 *
 * @example ./docs/ChannelPreviewLastMessage.md
 * @extends PureComponent
 */

class ChannelPreviewLastMessage extends PureComponent {
  static propTypes = {
    /** **Available from [chat context](https://getstream.github.io/stream-chat-react/#chat)** */
    setActiveChannel: PropTypes.func,
    /** **Available from [chat context](https://getstream.github.io/stream-chat-react/#chat)** */
    channel: PropTypes.object,
    closeMenu: PropTypes.func,
    unread_count: PropTypes.number,
    /** If channel of component is active (selected) channel */
    active: PropTypes.bool,
    latestMessage: PropTypes.string,
  };

  channelPreviewButton = React.createRef();

  onSelectChannel = () => {
    this.props.setActiveChannel(this.props.channel);
    this.channelPreviewButton.current.blur();
  };

  render() {
    const { intl } = this.props;

    const unreadClass =
      this.props.unread_count >= 1 ? 'str-chat__channel-preview--unread' : '';
    const activeClass = this.props.active
      ? 'str-chat__channel-preview--active'
      : '';
    const name = this.props.channel.data.name || this.props.channel.cid;
    return (
      <div
        className={`str-chat__channel-preview ${unreadClass} ${activeClass}`}
      >
        <button onClick={this.onSelectChannel} ref={this.channelPreviewButton}>
          {this.props.unread_count >= 1 && (
            <div className="str-chat__channel-preview--dot" />
          )}
          <Avatar image={this.props.channel.data.image} />
          <div className="str-chat__channel-preview-info">
            <span className="str-chat__channel-preview-title">{name}</span>
            <span className="str-chat__channel-preview-last-message">
              {!this.props.channel.state.messages[0]
                ? intl.formatMessage({
                    id: 'channel_preview.latest_message.none',
                    defaultMessage: 'Nothing yet...',
                  })
                : this.props.latestMessage}
            </span>
            {this.props.unread_count >= 1 && (
              <span className="str-chat__channel-preview-unread-count">
                {this.props.unread_count}
              </span>
            )}
          </div>
        </button>
      </div>
    );
  }
}

ChannelPreviewLastMessage = injectIntl(ChannelPreviewLastMessage);
export { ChannelPreviewLastMessage };
