 function showFeed() {
            document.getElementById('feed-view').classList.add('active');
            document.getElementById('messages-view').classList.remove('active');
            document.querySelectorAll('.toggle-btn')[0].classList.add('active');
            document.querySelectorAll('.toggle-btn')[1].classList.remove('active');
        }

        function showMessages() {
            document.getElementById('feed-view').classList.remove('active');
            document.getElementById('messages-view').classList.add('active');
            document.querySelectorAll('.toggle-btn')[0].classList.remove('active');
            document.querySelectorAll('.toggle-btn')[1].classList.add('active');
        }

        function showPostModal() {
            document.getElementById('postModal').classList.add('active');
        }

        function closePostModal() {
            document.getElementById('postModal').classList.remove('active');
        }

        function selectPostType(type) {
            // Update buttons
            const buttons = document.querySelectorAll('.type-btn');
            buttons.forEach(btn => btn.classList.remove('active'));
            event.target.classList.add('active');

            // Update forms
            document.getElementById('textForm').classList.remove('active');
            document.getElementById('fileForm').classList.remove('active');

            if (type === 'text') {
                document.getElementById('textForm').classList.add('active');
            } else {
                document.getElementById('fileForm').classList.add('active');
            }
        }

        // Close modal when clicking outside
        document.getElementById('postModal').addEventListener('click', function(e) {
            if (e.target === this) {
                closePostModal();
            }
        });